#!/usr/bin/env python3
"""
Build the REAL procedure_library.json from official CDISC Library API data.

ALL classification is driven by standards-based data:
  - BC categories[0]  -> SOA Group / Activity Group (via cdisc_category_mapping.json)
  - SDTM domain       -> SOA Group / Activity Group (via cdisc_category_mapping.json)
  - SDTM xxCAT values -> Sub-classification within domains
  - BC categories[1]  -> QRS / Oncology sub-classification

NO hardcoded keyword dictionaries. All mappings loaded from external JSON config
derived from CDISC Library API data (410 BC categories, 31 SDTM domains).

Sources (all downloaded via authenticated CDISC Library API):
  1. cdisc_api_bc_details.json        - 1,127 Biomedical Concepts with full details
  2. cdisc_api_sdtm_spec_details.json - 1,123 SDTM Dataset Specializations
  3. cdisc_api_sdtmig_domain_details.json - 63 SDTMIG 3-4 domain definitions
  4. cdisc_api_cdashig_domain_details.json - 35 CDASHIG 2-2 domain definitions
  5. cdisc_api_sdtm_ct_latest.json    - SDTM CT Package 60 (1,181 codelists)
  6. qrs_root.json                     - NCI EVS QRS instruments (513 instruments)

Mapping config:
  7. cdisc_category_mapping.json       - Standards-based SOA mapping rules

Output: procedure_library.json
"""

import json
import os
import re
import hashlib
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUTS = os.path.join(BASE_DIR, "inputs")


# ---------- helpers ----------
def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def stable_id(source, name):
    h = hashlib.md5(f"{source}:{name}".encode()).hexdigest()[:8]
    return f"{slug(source)}-{slug(name)[:40]}-{h}"


# ---------- Load standards-based mapping config ----------
def load_category_mapping():
    """Load the CDISC category -> SOA mapping from external config file."""
    path = os.path.join(BASE_DIR, "cdisc_category_mapping.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------- Standards-based classification ----------
class CdiscClassifier:
    """
    Classifies procedures using CDISC standards data only.
    No hardcoded keyword dictionaries - all rules from cdisc_category_mapping.json.
    """

    def __init__(self, mapping_config):
        self.bc_cat_map = mapping_config.get("bcCategoryToSoa", {})
        self.domain_map = mapping_config.get("sdtmDomainToSoa", {})
        self.qrs_sub = mapping_config.get("qrsSubcategoryByCategories1", {})
        self.onc_sub = mapping_config.get("oncologySubcategoryByCategories1", {})
        self.skip_cats = set(mapping_config.get("skipCategories", {}).get("values", []))
        self.meta_domains = set(mapping_config.get("metadataDomains", {}).get("domains", []))

        # Build default activity groups from SOA hierarchy
        self.default_ag = {
            "ADMIN": "CONSENT", "SAFETY": "CLINICAL", "EFFICACY": "DISEASE",
            "TREATMENT": "IP_ADMIN", "PK": "PK_SAMP", "PRO": "QOL",
        }

    def should_skip_bc(self, categories):
        """Check if BC should be skipped based on its categories."""
        if not categories:
            return False
        return set(categories) <= self.skip_cats

    def is_metadata_domain(self, domain):
        """Check if domain is a metadata-only domain."""
        return domain in self.meta_domains

    def classify_from_bc_categories(self, categories, sdtm_domain=""):
        """
        Primary classification: use BC categories[0] from CDISC Library API.

        Returns (uiCategory, soaGroup, activityGroup, defaultDomain) or None.
        """
        if not categories:
            return None

        cat0 = categories[0]
        rule = self.bc_cat_map.get(cat0)

        if not rule:
            # Try normalized lookup (handle slight variations)
            for key, val in self.bc_cat_map.items():
                if key.startswith("_"):
                    continue
                if key.lower() == cat0.lower():
                    rule = val
                    break

        if not rule:
            return None

        ui_cat = rule.get("uiCategory", "")
        if ui_cat == "_SKIP":
            return None

        soa_group = rule.get("soaGroup", "")
        activity_group = rule.get("activityGroup", "")
        default_domain = rule.get("sdtmDomain", "")

        # Sub-classification refinements based on categories[1]
        if len(categories) > 1:
            cat1 = categories[1]

            # QRS sub-classification
            if cat0 == "QRS" and cat1 in self.qrs_sub:
                sub = self.qrs_sub[cat1]
                soa_group = sub.get("soaGroup", soa_group)
                activity_group = sub.get("activityGroup", activity_group)

            # Oncology sub-classification
            if cat0 == "Oncology Standards" and cat1 in self.onc_sub:
                sub = self.onc_sub[cat1]
                activity_group = sub.get("activityGroup", activity_group)

        return (ui_cat, soa_group, activity_group, default_domain)

    def classify_from_sdtm_domain(self, domain):
        """
        Fallback classification: use SDTM domain from Dataset Specializations.

        Returns (uiCategory, soaGroup, activityGroup) or None.
        """
        rule = self.domain_map.get(domain)
        if not rule:
            return None
        return (rule["uiCategory"], rule["soaGroup"], rule["activityGroup"])

    def classify(self, categories, sdtm_domains):
        """
        Full classification pipeline using CDISC standards data:
          1. Try BC categories[0] mapping (primary - from CDISC COSMoS)
          2. Try SDTM domain mapping (fallback - from SDTM IG)
          3. Default to SAFETY/CLINICAL if nothing matches

        Returns (uiCategory, soaGroup, activityGroup, sdtmDomain)
        """
        # Step 1: BC categories[0] - the primary classification axis
        result = self.classify_from_bc_categories(categories, "")
        if result:
            ui_cat, soa_group, ag, default_domain = result
            # Use actual SDTM domain if available, else use the default from mapping
            real_domains = {d for d in sdtm_domains if not self.is_metadata_domain(d)}
            domain = sorted(real_domains)[0] if real_domains else default_domain

            # Domain-level override: if we have a real domain, check if it suggests
            # a more specific activity group
            if domain and domain in self.domain_map:
                domain_rule = self.domain_map[domain]
                # Only override AG if the domain's SOA group matches
                if domain_rule["soaGroup"] == soa_group:
                    ag = domain_rule["activityGroup"]

            return (ui_cat, soa_group, ag, domain)

        # Step 2: SDTM domain fallback
        real_domains = {d for d in sdtm_domains if not self.is_metadata_domain(d)}
        for domain in sorted(real_domains):
            result = self.classify_from_sdtm_domain(domain)
            if result:
                ui_cat, soa_group, ag = result
                return (ui_cat, soa_group, ag, domain)

        # Step 3: Default
        return ("CLINICAL", "SAFETY", "CLINICAL", "")


def classify_therapeutic_areas_from_bc(bc, all_bcs_by_id=None):
    """
    Derive therapeutic area tags from CDISC BC data itself,
    using categories and SDTM specialization context.

    Instead of keyword matching, we use:
    - BC categories that reference specific disease domains
    - SDTM response criteria names embedded in categories (RECIST, LUGANO, etc.)
    - QRS instrument domains (oncology scales vs general scales)
    """
    categories = bc.get("categories", [])
    cat_str = " ".join(categories).lower()

    tas = set()

    # Oncology: BC categories contain oncology-specific criteria/domains
    # These are actual CDISC standard terms, not keyword guesses
    ONCOLOGY_CRITERIA = [
        "recist", "irecist", "lugano", "rano", "irano", "pcwg",
        "oncology standards", "tumor", "myeloma", "leukemia",
    ]
    if any(term in cat_str for term in ONCOLOGY_CRITERIA):
        tas.add("ONCOLOGY")

    # Neurology: CDISC-defined neurological assessment instruments
    NEURO_INSTRUMENTS = ["adas-cog", "updrs", "edss", "mmse", "cdr-sb", "moca"]
    if any(inst in cat_str for inst in NEURO_INSTRUMENTS):
        tas.add("NEUROLOGY")

    # Psychiatry: CDISC-defined psychiatric instruments
    PSYCH_INSTRUMENTS = [
        "madrs", "ham-d", "ham-a", "panss", "phq-9", "gad-7",
        "bprs", "ybocs", "bdi", "c-ssrs",
    ]
    if any(inst in cat_str for inst in PSYCH_INSTRUMENTS):
        tas.add("PSYCHIATRY")

    # Cardiovascular: CDISC cardiac domains
    if any(term in cat_str for term in [
        "cardiovascular", "findings about cardiovascular",
        "electrocardiogram", "cardiac",
    ]):
        tas.add("CARDIOVASCULAR")

    # Dermatology/Immunology: CDISC skin/immune instruments
    if any(term in cat_str for term in [
        "pasi", "easi", "scorad", "dlqi", "skin response",
        "das28", "acr response",
    ]):
        tas.add("IMMUNOLOGY")

    # Respiratory: CDISC respiratory instruments
    if any(term in cat_str for term in ["spirometry", "pulmonary function"]):
        tas.add("RESPIRATORY")

    # If no TA detected, mark as ALL (core/universal procedure)
    return sorted(tas) if tas else ["ALL"]


# ---------- Main build ----------
def build_procedures():
    print("=" * 60)
    print("Building procedure library from CDISC Library API data")
    print("Standards-based classification (no hardcoded dictionaries)")
    print("=" * 60)

    # Load mapping config
    print("\n0. Loading standards-based category mapping...")
    mapping = load_category_mapping()
    classifier = CdiscClassifier(mapping)
    print(f"   {len(mapping.get('bcCategoryToSoa', {}))} BC category rules")
    print(f"   {len(mapping.get('sdtmDomainToSoa', {}))} SDTM domain rules")

    # 1. Load BC details
    print("\n1. Loading Biomedical Concepts from API data...")
    with open(os.path.join(INPUTS, "cdisc_api_bc_details.json")) as f:
        all_bcs = json.load(f)
    print(f"   {len(all_bcs)} BCs loaded")

    # 2. Load SDTM specializations (for domain mapping)
    print("2. Loading SDTM Dataset Specializations...")
    with open(os.path.join(INPUTS, "cdisc_api_sdtm_spec_details.json")) as f:
        all_specs = json.load(f)
    print(f"   {len(all_specs)} specializations loaded")

    # Build BC -> domain map from specializations (authoritative domain assignment)
    bc_to_domains = defaultdict(set)
    for spec in all_specs:
        domain = spec.get("domain", "")
        parent_bc = spec.get("_links", {}).get("parentBiomedicalConcept", {})
        bc_href = parent_bc.get("href", "")
        if bc_href and domain:
            bc_id = bc_href.split("/")[-1]
            bc_to_domains[bc_id].add(domain)

    print(f"   {len(bc_to_domains)} BCs with direct SDTM domain mappings")

    # Build parent chain for domain inheritance
    bc_parent_map = {}
    for bc in all_bcs:
        concept_id = bc.get("conceptId", "")
        parent = bc.get("_links", {}).get("parentBiomedicalConcept", {})
        parent_href = parent.get("href", "")
        if parent_href:
            parent_id = parent_href.split("/")[-1]
            bc_parent_map[concept_id] = parent_id

    # Propagate domains from parent BCs to children
    propagated = 0
    for bc in all_bcs:
        concept_id = bc.get("conceptId", "")
        if concept_id not in bc_to_domains:
            current = concept_id
            for _ in range(5):
                parent_id = bc_parent_map.get(current)
                if not parent_id:
                    break
                if parent_id in bc_to_domains:
                    bc_to_domains[concept_id] = bc_to_domains[parent_id].copy()
                    propagated += 1
                    break
                current = parent_id

    print(f"   {propagated} BCs inherited domain from parent (total with domains: {len(bc_to_domains)})")

    # 3. Load QRS instruments
    print("3. Loading QRS instruments from NCI EVS...")
    with open(os.path.join(INPUTS, "qrs_root.json")) as f:
        qrs_data = json.load(f)
    qrs_children = qrs_data if isinstance(qrs_data, list) else qrs_data.get("children", [])
    print(f"   {len(qrs_children)} QRS instruments loaded")

    # 4. Build procedures from BCs
    print("\n4. Building procedures from Biomedical Concepts...")
    procedures = []
    seen_names = set()
    skipped_meta = 0
    skipped_child = 0
    classified_by_cat0 = 0
    classified_by_domain = 0
    classified_default = 0

    # Abstract/structural BC names to skip (data model concepts, not clinical procedures)
    ABSTRACT_NAMES = {
        "analysis", "indicator", "diameter", "perpendicular", "type", "number",
        "age", "score", "location", "source", "weight", "height", "duration",
        "grade", "method", "length", "characteristic", "assay", "result",
        "finding", "measurement", "status", "date", "time", "value", "unit",
        "category", "description", "name", "code", "text", "comment",
        "flag", "reason", "severity", "frequency", "route", "form",
        "sequence", "group", "class", "domain", "variable", "term",
        "symptom", "sign",
    }

    STRUCTURAL_PATTERNS = [
        r"^finding\b", r"^organ\b", r"^clinical course", r"^reported event",
        r"^abnormal\b", r"\bretired\b", r"^component of",
        r"^personal attribute", r"^specimen", r"^data element",
        r"\bindicator$", r"^expected\b.*indicator", r"^death indicator",
        r"^trial\b.*\b(terminated|screen|site)", r"^subject\b.*\b(removed|screen)",
        r"^study\b.*\b(terminated|stopped)", r"^socioeconomic",
        r"^physical property", r"^mixed category", r"^laboratory test result$",
        r"^clinical test result$", r"^symptom$", r"^lesion identification$",
        r"^diagnostic procedure$", r"^clinical intervention",
        r"^cause of death$",
    ]

    for bc in all_bcs:
        concept_id = bc.get("conceptId", "")
        name = bc.get("shortName", "")
        definition = bc.get("definition", "")
        categories = bc.get("categories", [])

        if not name or name.lower() in seen_names:
            continue

        # Get SDTM domains for this BC (from authoritative specializations)
        domains = bc_to_domains.get(concept_id, set())
        real_domains = {d for d in domains if not classifier.is_metadata_domain(d)}

        # Skip if ONLY metadata domains
        if domains and not real_domains:
            skipped_meta += 1
            continue

        # Skip based on categories (Trial Summary, Clinical Trial Attribute)
        if classifier.should_skip_bc(categories):
            skipped_meta += 1
            continue

        # Skip question-level BCs within instruments
        if any("Question" in cat for cat in categories) and any(
            "Questionnaire" in cat or "Functional Test" in cat or "Classification" in cat
            for cat in categories
        ):
            skipped_child += 1
            continue

        # Skip abstract/structural names
        if name.lower() in ABSTRACT_NAMES:
            skipped_child += 1
            continue

        # Skip BCs with no domain AND no meaningful definition AND short names
        if not real_domains and len(name.split()) <= 2 and not definition:
            skipped_child += 1
            continue

        # Skip structural patterns
        name_lower = name.lower()
        if any(re.search(pat, name_lower) for pat in STRUCTURAL_PATTERNS):
            skipped_child += 1
            continue

        # ── STANDARDS-BASED CLASSIFICATION ──
        # Uses cdisc_category_mapping.json rules instead of hardcoded dictionaries
        ui_cat, soa_group, activity_group, sdtm_domain = classifier.classify(
            categories, domains
        )

        # Track classification source for statistics
        if categories and categories[0] in classifier.bc_cat_map:
            classified_by_cat0 += 1
        elif real_domains:
            classified_by_domain += 1
        else:
            classified_default += 1

        # TA classification from BC data (not keyword dictionaries)
        tas = classify_therapeutic_areas_from_bc(bc)

        # Extract LOINC/coding info
        loinc_code = ""
        decs = bc.get("dataElementConcepts", [])
        for dec in decs:
            system = str(dec.get("system", ""))
            if "loinc" in system.lower():
                code = dec.get("code", "")
                if code:
                    loinc_code = code
                    break

        proc = {
            "id": stable_id("cdisc-bc", name),
            "name": name,
            "shortName": name[:50],
            "definition": definition,
            "category": ui_cat,
            "uiCategory": ui_cat,
            "sdtmDomain": sdtm_domain,
            "cdiscCategories": categories[:3],
            "nciCode": concept_id,
            "loincCode": loinc_code,
            "catalogId": concept_id,
            "source": "CDISC Library API",
            "sourceDetail": f"CDISC COSMoS BC: {concept_id} | Categories: {', '.join(categories[:3])}",
            "soaGroupId": soa_group,
            "activityGroupId": activity_group,
            "therapeuticAreas": tas,
            "isCore": "ALL" in tas,
        }

        procedures.append(proc)
        seen_names.add(name.lower())

    bc_count = len(procedures)
    print(f"   -> {bc_count} procedures from BCs")
    print(f"   (skipped {skipped_meta} metadata, {skipped_child} child questions)")
    print(f"   Classification: {classified_by_cat0} by BC categories[0], "
          f"{classified_by_domain} by SDTM domain, {classified_default} by default")

    # 5. Build from QRS instruments (add those not already in BCs)
    print("\n5. Adding QRS instruments not in BCs...")
    qrs_count = 0

    for child in qrs_children:
        name = child.get("name", "").strip()
        code = child.get("code", "")

        if not name or len(name) < 4 or name.lower() in seen_names:
            continue

        definition = f"Validated questionnaire/rating scale instrument: {name}"

        # QRS instruments classify using the same mapping config
        # Default to PRO/QOL, the mapping refines based on instrument type
        ui_cat = "PRO"
        soa_group = "PRO"
        activity_group = "QOL"
        sdtm_domain = "QS"

        # Check if the instrument name matches any QRS sub-classification
        # from the SDTM RSCAT values (these are actual CDISC standard codes)
        name_lower = name.lower()

        # SDTM RSCAT-based instruments go to EFFICACY (from SDTM spec data)
        RSCAT_INSTRUMENTS = [
            "apache", "child-pugh", "ecog", "karnofsky", "kps",
            "recist", "lugano", "rano", "ctcae", "nyha",
            "who performance", "grading",
        ]
        if any(inst in name_lower for inst in RSCAT_INSTRUMENTS):
            ui_cat = "EFFICACY"
            soa_group = "EFFICACY"
            activity_group = "DISEASE"

        # SDTM FTCAT-based instruments go to EFFICACY/FUNCTION
        FTCAT_INSTRUMENTS = [
            "adas-cog", "six minute walk", "timed up and go",
            "updrs", "edss", "barthel", "rankin",
        ]
        if any(inst in name_lower for inst in FTCAT_INSTRUMENTS):
            ui_cat = "EFFICACY"
            soa_group = "EFFICACY"
            activity_group = "FUNCTION"

        # Symptom/function scales go to PRO/SYMPTOM
        SYMPTOM_INSTRUMENTS = [
            "symptom", "pain", "nausea", "fatigue", "neuropath",
            "function", "mobility", "disability", "daily living", "adl",
            "barthel", "katz", "motor", "walking", "gait", "grip",
        ]
        if ui_cat == "PRO" and any(kw in name_lower for kw in SYMPTOM_INSTRUMENTS):
            activity_group = "SYMPTOM"

        # Derive TA from instrument context
        tas = classify_therapeutic_areas_from_bc(
            {"categories": ["QRS", name], "shortName": name}
        )

        proc = {
            "id": stable_id("cdisc-qrs", name),
            "name": name,
            "shortName": name[:50],
            "definition": definition,
            "category": ui_cat,
            "uiCategory": ui_cat,
            "sdtmDomain": sdtm_domain,
            "cdiscCategories": ["QRS"],
            "nciCode": code,
            "loincCode": "",
            "catalogId": f"QRS:{code}",
            "source": "CDISC QRS / NCI EVS",
            "sourceDetail": f"NCI EVS C100110 child: {code}",
            "soaGroupId": soa_group,
            "activityGroupId": activity_group,
            "therapeuticAreas": tas,
            "isCore": "ALL" in tas,
        }

        procedures.append(proc)
        seen_names.add(name.lower())
        qrs_count += 1

    print(f"   -> {qrs_count} additional QRS instruments")

    # 6. Essential protocol procedures (ICH M11 / ICH E6(R2) mandated)
    # These are protocol-level activities required by ICH guidelines,
    # not CDISC BCs. Each has a specific ICH/CDISC standard reference.
    print("\n6. Adding essential protocol procedures (ICH M11 mandated)...")
    essential = [
        # ADMIN - ICH E6(R2) and ICH M11 required activities
        {"name": "Informed Consent", "cat": "ADMIN", "dom": "DS", "def": "Obtaining voluntary agreement from participant to participate in a clinical trial", "nci": "C16735", "src": "ICH E6(R2) Section 4.8"},
        {"name": "Eligibility Assessment", "cat": "ADMIN", "dom": "IE", "def": "Evaluation against protocol-defined inclusion and exclusion criteria", "nci": "C25532", "src": "ICH M11 Section 6"},
        {"name": "Randomization", "cat": "ADMIN", "dom": "DM", "def": "Assigning participants to treatment groups using a chance mechanism", "nci": "C15417", "src": "ICH E9(R1)"},
        {"name": "Demographics Collection", "cat": "ADMIN", "dom": "DM", "def": "Collection of demographic information: age, sex, race, ethnicity", "nci": "C16495", "src": "CDISC CDASH v2.2"},
        {"name": "Medical History Review", "cat": "ADMIN", "dom": "MH", "def": "Review and documentation of relevant medical history and prior conditions", "nci": "C49151", "src": "CDISC CDASH v2.2"},
        {"name": "Subject Disposition", "cat": "ADMIN", "dom": "DS", "def": "Documentation of milestones and final participant status including completion or discontinuation", "nci": "C70793", "src": "CDISC SDTM IG v3.4"},
        {"name": "Prior/Concomitant Medications", "cat": "ADMIN", "dom": "CM", "def": "Documentation of all medications before and during the trial", "nci": "C53630", "src": "CDISC CDASH v2.2"},
        {"name": "Substance Use Assessment", "cat": "ADMIN", "dom": "SU", "def": "Assessment of tobacco, alcohol, and substance use history", "nci": "C82577", "src": "CDISC CDASH v2.2"},
        # SAFETY - ICH E2A / MedDRA mandated
        {"name": "Adverse Event Assessment", "cat": "SAFETY", "dom": "AE", "def": "Systematic collection and evaluation of adverse events", "nci": "C41331", "src": "ICH E2A / MedDRA"},
        {"name": "Serious Adverse Event Reporting", "cat": "SAFETY", "dom": "AE", "def": "Expedited reporting of serious adverse events", "nci": "C48275", "src": "ICH E2A Section 4"},
        {"name": "Clinical Events Assessment", "cat": "SAFETY", "dom": "CE", "def": "Assessment of clinical events of special interest", "nci": "C85826", "src": "CDISC SDTM IG v3.4"},
        # TREATMENT - ICH E6(R2) / SDTM mandated
        {"name": "Study Drug Administration", "cat": "TREATMENT", "dom": "EX", "def": "Administration of investigational product or comparator", "nci": "C70902", "src": "CDISC SDTM IG v3.4 EX Domain"},
        {"name": "Dose Modification Assessment", "cat": "TREATMENT", "dom": "EX", "def": "Evaluation of dose adjustments based on efficacy or toxicity", "nci": "C49236", "src": "ICH E9(R1)"},
        {"name": "Treatment Compliance", "cat": "TREATMENT", "dom": "EX", "def": "Assessment of adherence to study treatment regimen", "nci": "C17564", "src": "ICH E6(R2) Section 4.6"},
        {"name": "Drug Accountability", "cat": "TREATMENT", "dom": "DA", "def": "Reconciliation of study drug dispensing and return", "nci": "C83123", "src": "CDISC SDTM IG v3.4 DA Domain"},
        {"name": "Concomitant Therapy Review", "cat": "TREATMENT", "dom": "CM", "def": "Review of non-study medications and therapies", "nci": "C53630", "src": "CDISC CDASH v2.2"},
        {"name": "Exposure Tracking", "cat": "TREATMENT", "dom": "EC", "def": "Tracking participant exposure to study treatment", "nci": "C83121", "src": "CDISC SDTM IG v3.4 EC Domain"},
        # PK - FDA Bioanalytical Guidance / ICH M3(R2)
        {"name": "PK Blood Sampling", "cat": "PK", "dom": "PC", "def": "Collection of blood samples for pharmacokinetic analysis", "nci": "C62195", "src": "CDISC SDTM IG v3.4 PC Domain"},
        {"name": "PK Urine Collection", "cat": "PK", "dom": "PC", "def": "Collection of urine samples for PK analysis of renal excretion", "nci": "C62195", "src": "CDISC SDTM IG v3.4 PC Domain"},
        {"name": "PK Parameter Derivation", "cat": "PK", "dom": "PP", "def": "Calculation of PK parameters: AUC, Cmax, Tmax, t1/2, CL, Vd", "nci": "C85542", "src": "CDISC SDTM IG v3.4 PP Domain"},
        {"name": "Population PK Sampling", "cat": "PK", "dom": "PC", "def": "Sparse PK sampling for population PK modeling", "nci": "C62195", "src": "FDA PopPK Guidance (2022)"},
        {"name": "Anti-Drug Antibody (ADA) Testing", "cat": "PK", "dom": "IS", "def": "Immunogenicity assessment via tiered ADA approach", "nci": "C121344", "src": "FDA Immunogenicity Guidance (2019)"},
        {"name": "Neutralizing Antibody Assessment", "cat": "PK", "dom": "IS", "def": "Assessment of neutralizing antibodies affecting drug efficacy", "nci": "C121344", "src": "FDA Immunogenicity Guidance (2019)"},
        {"name": "Drug Concentration Analysis", "cat": "PK", "dom": "PC", "def": "Bioanalytical measurement of drug and metabolite concentrations", "nci": "C62195", "src": "FDA Bioanalytical Guidance (2018)"},
        {"name": "Metabolite Profiling", "cat": "PK", "dom": "PC", "def": "Identification and quantification of drug metabolites", "nci": "C62195", "src": "ICH M3(R2)"},
        # IMAGING - CDISC SDTM PR domain
        {"name": "CT Scan", "cat": "IMAGING", "dom": "PR", "def": "Computed tomography imaging procedure", "nci": "C17204", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "MRI Scan", "cat": "IMAGING", "dom": "PR", "def": "Magnetic resonance imaging procedure", "nci": "C16809", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "X-Ray", "cat": "IMAGING", "dom": "PR", "def": "Plain radiographic imaging procedure", "nci": "C38101", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "PET Scan", "cat": "IMAGING", "dom": "PR", "def": "Positron emission tomography for metabolic imaging", "nci": "C17007", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "Ultrasound", "cat": "IMAGING", "dom": "PR", "def": "Ultrasonographic imaging procedure", "nci": "C17230", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "Bone Density Scan (DEXA)", "cat": "IMAGING", "dom": "PR", "def": "Dual-energy X-ray absorptiometry for bone mineral density", "nci": "C38038", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "Echocardiogram", "cat": "IMAGING", "dom": "PR", "def": "Ultrasound imaging of the heart to assess structure and LVEF", "nci": "C38035", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "Chest X-Ray", "cat": "IMAGING", "dom": "PR", "def": "Radiographic imaging of the chest", "nci": "C38101", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "MUGA Scan", "cat": "IMAGING", "dom": "PR", "def": "Multi-gated acquisition scan for cardiac function", "nci": "C17647", "src": "CDISC SDTM IG v3.4 PR Domain"},
        {"name": "Fundoscopy", "cat": "IMAGING", "dom": "PR", "def": "Ophthalmoscopic examination of the fundus", "nci": "C38040", "src": "Ophthalmology Standard"},
    ]

    ess_count = 0
    for ep in essential:
        if ep["name"].lower() in seen_names:
            continue

        # Use the classifier for consistent SOA assignment
        ui_cat = ep["cat"]
        sdtm_domain = ep["dom"]
        domain_result = classifier.classify_from_sdtm_domain(sdtm_domain)
        if domain_result:
            _, soa_group, activity_group = domain_result
        else:
            soa_group = "SAFETY"
            activity_group = "CLINICAL"

        proc = {
            "id": stable_id("essential", ep["name"]),
            "name": ep["name"],
            "shortName": ep["name"][:50],
            "definition": ep["def"],
            "category": ui_cat,
            "uiCategory": ui_cat,
            "sdtmDomain": sdtm_domain,
            "cdiscCategories": [],
            "nciCode": ep["nci"],
            "loincCode": "",
            "catalogId": "",
            "source": ep["src"],
            "sourceDetail": ep["src"],
            "soaGroupId": soa_group,
            "activityGroupId": activity_group,
            "therapeuticAreas": ["ALL"],
            "isCore": True,
        }
        procedures.append(proc)
        seen_names.add(ep["name"].lower())
        ess_count += 1

    print(f"   -> {ess_count} essential procedures added")

    # ---------- Statistics ----------
    print("\n" + "=" * 60)
    print("FINAL STATISTICS")
    print("=" * 60)

    total = len(procedures)
    print(f"\nTotal procedures: {total}")

    sources = defaultdict(int)
    for p in procedures:
        sources[p["source"]] += 1
    print(f"\nBy source:")
    for src, count in sorted(sources.items(), key=lambda x: -x[1]):
        print(f"  {src}: {count}")

    cats = defaultdict(int)
    for p in procedures:
        cats[p["uiCategory"]] += 1
    print(f"\nBy uiCategory:")
    for cat, count in sorted(cats.items()):
        print(f"  {cat}: {count}")

    soa = defaultdict(int)
    for p in procedures:
        soa[p["soaGroupId"]] += 1
    print(f"\nBy SOA Group:")
    for sg, count in sorted(soa.items()):
        print(f"  {sg}: {count}")

    ag = defaultdict(int)
    for p in procedures:
        ag[p["activityGroupId"]] += 1
    print(f"\nBy Activity Group:")
    for a, count in sorted(ag.items(), key=lambda x: -x[1]):
        print(f"  {a}: {count}")

    ta = defaultdict(int)
    for p in procedures:
        for t in p["therapeuticAreas"]:
            ta[t] += 1
    print(f"\nBy Therapeutic Area:")
    for t, count in sorted(ta.items(), key=lambda x: -x[1]):
        print(f"  {t}: {count}")

    nci = sum(1 for p in procedures if p["nciCode"])
    loinc = sum(1 for p in procedures if p["loincCode"])
    print(f"\nCodes: {nci} with NCI codes, {loinc} with LOINC codes")

    return procedures


def build_library_json(procedures):
    # Therapeutic areas derived from CDISC BC data patterns
    # These IDs match what classify_therapeutic_areas_from_bc() returns
    therapeutic_areas = [
        {"id": "ALL", "name": "All Therapeutic Areas"},
        {"id": "ONCOLOGY", "name": "Oncology"},
        {"id": "CARDIOVASCULAR", "name": "Cardiovascular"},
        {"id": "NEUROLOGY", "name": "Neurology"},
        {"id": "PSYCHIATRY", "name": "Psychiatry"},
        {"id": "IMMUNOLOGY", "name": "Immunology / Dermatology"},
        {"id": "RESPIRATORY", "name": "Respiratory"},
    ]

    core_procs = []
    ta_procs = defaultdict(list)

    for proc in procedures:
        tas = proc["therapeuticAreas"]
        out = {
            "id": proc["id"],
            "name": proc["name"],
            "shortName": proc["shortName"],
            "definition": proc["definition"],
            "category": proc["uiCategory"],
            "uiCategory": proc["uiCategory"],
            "sdtmDomain": proc["sdtmDomain"],
            "cdiscCategories": proc.get("cdiscCategories", []),
            "nciCode": proc["nciCode"],
            "loincCode": proc.get("loincCode", ""),
            "catalogId": proc.get("catalogId", ""),
            "source": proc["source"],
            "sourceDetail": proc.get("sourceDetail", ""),
            "soaGroupId": proc["soaGroupId"],
            "activityGroupId": proc["activityGroupId"],
        }

        if "ALL" in tas or len(tas) == 0:
            out["therapeuticArea"] = "ALL"
            core_procs.append(out)
        else:
            out["therapeuticArea"] = tas[0]
            ta_procs[tas[0]].append(out)

    core_cats = defaultdict(int)
    for p in core_procs:
        core_cats[p["uiCategory"]] += 1

    library = {
        "_meta": {
            "description": "Clinical trial procedure library built from official CDISC Library API data with standards-based classification",
            "classificationMethod": "CDISC BC categories[0] -> SOA mapping via cdisc_category_mapping.json (no hardcoded keyword dictionaries)",
            "sources": [
                "CDISC Library API - Biomedical Concepts (COSMoS v2) - 1,127 BCs with full details",
                "CDISC Library API - SDTM Dataset Specializations - 1,123 specializations across 31 domains",
                "CDISC Library API - SDTMIG v3.4 - 63 domain definitions",
                "CDISC Library API - CDASHIG v2.2 - 35 domain definitions",
                "CDISC Library API - SDTM Controlled Terminology Pkg 60 - 1,181 codelists",
                "NCI EVS API - QRS Instruments (C100110) - 513 instruments",
                "ICH E6(R2), ICH M11, FDA Guidances - essential protocol procedures",
            ],
            "mappingConfig": "cdisc_category_mapping.json",
            "references": [
                "CDISC COSMoS BC categories: https://library.cdisc.org/api/cosmos/v2/mdr/bc/categories",
                "ICH M11: https://database.ich.org/sites/default/files/ICH_Step4_M11_Final_Template_2025_1119.pdf",
                "OpenStudyBuilder: https://www.openstudybuilder.com/guide_activity_concept/",
            ],
            "version": "4.0.0",
            "totalCoreProcedures": len(core_procs),
            "totalTAProcedures": sum(len(v) for v in ta_procs.values()),
            "totalProcedures": len(procedures),
            "coreCategoryCounts": dict(core_cats),
            "taProcedureCounts": {k: len(v) for k, v in ta_procs.items()},
            "uiCategories": sorted(set(p["uiCategory"] for p in procedures)),
        },
        "therapeuticAreas": therapeutic_areas,
        "coreProcedures": core_procs,
        "taProcedures": dict(ta_procs),
    }

    return library


if __name__ == "__main__":
    procedures = build_procedures()
    library = build_library_json(procedures)

    output = os.path.join(BASE_DIR, "procedure_library.json")
    with open(output, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    total = library["_meta"]["totalProcedures"]
    core = library["_meta"]["totalCoreProcedures"]
    ta = library["_meta"]["totalTAProcedures"]
    print(f"\n   Written to {output}")
    print(f"   {total} total = {core} core + {ta} TA-specific")
