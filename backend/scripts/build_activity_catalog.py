#!/usr/bin/env python3
"""
Build Activity Catalog from CDISC COSMoS Standards
===================================================

Downloads the official CDISC Biomedical Concepts data from the COSMoS GitHub
repository and generates a structured activity catalog for the Schedule of
Activities (SOA) module.

Data Sources:
  - COSMoS BC Hierarchy CSV (procedure-level concepts with NCI codes)
  - COSMoS SDTM Dataset Specializations CSV (domain/variable mappings)
  - Existing sdtm_domains.json (domain metadata)

Usage:
    python backend/scripts/build_activity_catalog.py

Output:
    backend/app/terminology/activity_catalog.json
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# URLs for CDISC COSMoS data (official GitHub exports)
# ---------------------------------------------------------------------------
BC_HIERARCHY_URL = (
    "https://raw.githubusercontent.com/cdisc-org/COSMoS/main/"
    "export/cdisc_biomedical_concepts_hierarchy_latest.csv"
)
SDTM_SPECIALIZATIONS_URL = (
    "https://raw.githubusercontent.com/cdisc-org/COSMoS/main/"
    "export/cdisc_sdtm_dataset_specializations_latest.csv"
)

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
TERMINOLOGY_DIR = BACKEND_DIR / "app" / "terminology"
OUTPUT_FILE = TERMINOLOGY_DIR / "activity_catalog.json"
SDTM_DOMAINS_FILE = TERMINOLOGY_DIR / "sdtm_domains.json"

# ---------------------------------------------------------------------------
# CDISC Category -> UI Category mapping
# ---------------------------------------------------------------------------
# Maps CDISC bc_categories values to our 9 UI categories used in SOAModule.
# A CDISC concept may have multiple categories; we use the first match.

CATEGORY_MAP: dict[str, str] = {
    # ADMIN
    "Subject Disposition": "ADMIN",
    "Protocol Disposition Events": "ADMIN",
    "Demographics": "ADMIN",
    "Demographic Data": "ADMIN",
    "Clinical Trial Attribute": "ADMIN",
    "Trial Summary": "ADMIN",
    "Birth Event": "ADMIN",
    "Personal Attribute": "ADMIN",

    # CLINICAL
    "Vital Signs": "CLINICAL",
    "Blood Pressure": "CLINICAL",
    "Body Measurements": "CLINICAL",
    "Surgeries": "CLINICAL",
    "Procedures": "CLINICAL",
    "Reproductive Findings": "CLINICAL",

    # LABORATORY
    "Laboratory Tests": "LABORATORY",
    "Hematology Tests": "LABORATORY",
    "Chemistry Tests": "LABORATORY",
    "Liver Function Tests": "LABORATORY",
    "Coagulation Study": "LABORATORY",
    "Renal Function Tests": "LABORATORY",
    "Blood Protein Measurements": "LABORATORY",
    "Mixed Category Laboratory Procedure": "LABORATORY",
    "Assay": "LABORATORY",
    "Protein or Enzyme Measurements": "LABORATORY",
    "Blood Cell Counts": "LABORATORY",
    "Urine Protein Measurement": "LABORATORY",
    "Ratio Measurements": "LABORATORY",

    # IMAGING
    "Diagnostic Imaging": "IMAGING",
    "Medical Imaging": "IMAGING",
    "Diagnostic Procedures": "IMAGING",
    "Biopsies": "IMAGING",

    # EFFICACY
    "Oncology Standards": "EFFICACY",
    "Disease Response": "EFFICACY",
    "Disease Response Criteria": "EFFICACY",
    "Staging": "EFFICACY",
    "Cancer": "EFFICACY",
    "Breast Cancer": "EFFICACY",

    # SAFETY
    "Adverse Events": "SAFETY",
    "Events": "SAFETY",
    "Reported Events": "SAFETY",
    "Event Occurrence Indicators": "SAFETY",
    "Electrocardiogram Findings": "SAFETY",
    "ECG Measurements": "SAFETY",
    "ECG Findings": "SAFETY",
    "ECG Abnormalities": "SAFETY",
    "Substance Use": "SAFETY",
    "Medical History": "SAFETY",
    "Clinical Findings Indicator": "SAFETY",
    "Indicator": "SAFETY",
    "Symptom Indicator": "SAFETY",

    # PK
    "Biospecimen Events": "PK",

    # PRO
    "QRS": "PRO",
    "Functional Assessment": "PRO",
    "QRS Instrument Questions": "PRO",
    "Clinical or Research Assessment Classification": "PRO",

    # TREATMENT (mapped via SDTM domain EX/EC)
    # No direct CDISC category; assigned based on domain

    # LABORATORY subtypes
    "Immunology Tests": "LABORATORY",
    "Immunodiagnostic Procedure": "LABORATORY",
    "Immunogenicity Specimen Assessments": "LABORATORY",
    "Genetic Testing": "LABORATORY",
    "Gene Expression Analysis": "LABORATORY",
    "Genetic Variation Analysis": "LABORATORY",
    "Molecular Analysis": "LABORATORY",

    # CLINICAL subtypes
    "Musculoskeletal Finding": "CLINICAL",
    "Musculoskeletal Findings": "CLINICAL",
    "Findings": "CLINICAL",
    "Clinical Test Results": "CLINICAL",

    # SAFETY subtypes
    "Drug-Induced Liver Injury": "SAFETY",
    "DILI": "SAFETY",
    "Death Diagnosis and Details": "SAFETY",
    "Cardiovascular System Finding": "SAFETY",
    "Findings About Cardiovascular Events": "SAFETY",
    "Skin Response": "SAFETY",
}

# SDTM domain -> UI category fallback (when no bc_categories match)
DOMAIN_TO_CATEGORY: dict[str, str] = {
    "DM": "ADMIN", "DS": "ADMIN", "IE": "ADMIN", "CO": "ADMIN",
    "SE": "ADMIN", "SV": "ADMIN",
    "VS": "CLINICAL", "PE": "CLINICAL", "PR": "CLINICAL",
    "LB": "LABORATORY",
    "AE": "SAFETY", "MH": "SAFETY", "EG": "SAFETY",
    "CM": "SAFETY", "CE": "SAFETY", "DV": "SAFETY",
    "EX": "TREATMENT", "EC": "TREATMENT",
    "PC": "PK", "PP": "PK",
    "QS": "PRO",
    "TU": "EFFICACY", "TR": "EFFICACY", "RS": "EFFICACY",
}

# SDTM specialization domain short_name -> SDTM domain code mapping
SDTM_SPEC_DOMAIN_MAP: dict[str, str] = {
    "AE": "AE",
    "BE": "BE",
    "CM": "CM",
    "DD": "DD",
    "DM": "DM",
    "DS": "DS",
    "EC": "EC",
    "EG": "EG",
    "EX": "EX",
    "LB": "LB",
    "VS": "VS",
    "PE": "PE",
    "PC": "PC",
    "QS": "QS",
    "MH": "MH",
    "IE": "IE",
    "PR": "PR",
    "TU": "TU",
    "TR": "TR",
    "RS": "RS",
}


def download_csv(url: str) -> list[dict]:
    """Download a CSV file and return a list of dicts."""
    print(f"  Downloading: {url.split('/')[-1]}")
    req = urllib.request.Request(url, headers={"User-Agent": "ProtocolAuthoring/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8")

    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def resolve_ui_category(categories_str: str, sdtm_domain: str = "") -> str:
    """Resolve a CDISC categories string to one of our 9 UI categories."""
    if categories_str:
        cats = [c.strip() for c in categories_str.split(";")]
        for cat in cats:
            if cat in CATEGORY_MAP:
                return CATEGORY_MAP[cat]

    # Fallback: use SDTM domain
    if sdtm_domain and sdtm_domain in DOMAIN_TO_CATEGORY:
        return DOMAIN_TO_CATEGORY[sdtm_domain]

    return "CLINICAL"  # default


def resolve_sdtm_domain(categories_str: str, synonyms_str: str = "") -> str:
    """Try to infer an SDTM domain from CDISC categories and synonyms."""
    cats = categories_str.lower() if categories_str else ""

    # Direct mappings from categories
    if "vital signs" in cats or "blood pressure" in cats or "body measurements" in cats:
        return "VS"
    if "laboratory" in cats or "hematology" in cats or "chemistry" in cats:
        return "LB"
    if "coagulation" in cats:
        return "LB"
    if "liver function" in cats:
        return "LB"
    if "renal function" in cats:
        return "LB"
    if "electrocardiogram" in cats or "ecg" in cats:
        return "EG"
    if "adverse event" in cats:
        return "AE"
    if "subject disposition" in cats or "protocol disposition" in cats:
        return "DS"
    if "demographics" in cats or "demographic data" in cats or "birth event" in cats:
        return "DM"
    if "substance use" in cats:
        return "SU"
    if "medical history" in cats:
        return "MH"
    if "oncology" in cats or "disease response" in cats or "staging" in cats:
        return "RS"
    if "biospecimen" in cats:
        return "BE"
    if "immunology" in cats or "immunogenicity" in cats:
        return "IS"
    if "qrs" in cats or "functional assessment" in cats:
        return "QS"
    if "diagnostic imaging" in cats or "medical imaging" in cats:
        return "PR"
    if "procedures" in cats or "surgeries" in cats or "biopsies" in cats:
        return "PR"
    if "cancer" in cats or "carcinoma" in cats:
        return "RS"
    if "genetic" in cats or "molecular" in cats or "gene" in cats:
        return "LB"
    if "clinical trial attribute" in cats or "trial summary" in cats:
        return "TS"
    if "musculoskeletal" in cats:
        return "PE"
    if "reproductive" in cats:
        return "RE"
    if "indicator" in cats:
        return ""
    if "findings" in cats:
        return ""

    return ""


def build_catalog():
    """Main entry point: build the activity catalog."""
    print("=" * 70)
    print("CDISC COSMoS Activity Catalog Builder")
    print("=" * 70)

    # -----------------------------------------------------------------------
    # 1. Load existing SDTM domains for validation
    # -----------------------------------------------------------------------
    print("\n[1/4] Loading existing SDTM domains...")
    with open(SDTM_DOMAINS_FILE, "r", encoding="utf-8") as f:
        sdtm_domains = json.load(f)
    domain_names = {d["id"]: d["name"] for d in sdtm_domains}
    print(f"  Loaded {len(domain_names)} SDTM domains")

    # -----------------------------------------------------------------------
    # 2. Download and parse BC Hierarchy CSV
    # -----------------------------------------------------------------------
    print("\n[2/4] Downloading CDISC Biomedical Concepts hierarchy...")
    bc_rows = download_csv(BC_HIERARCHY_URL)
    print(f"  Downloaded {len(bc_rows)} BC entries")

    # Extract unique BCs at hierarchy levels 0 and 1 (procedure-level)
    seen_ids = set()
    procedure_bcs = []

    for row in bc_rows:
        bc_id = row.get("bc_id", "").strip()
        level_str = row.get("bc_hierarchy_level", "").strip()

        if not bc_id or not level_str:
            continue

        try:
            level = int(level_str)
        except ValueError:
            continue

        if level > 1:
            continue

        if bc_id in seen_ids:
            continue
        seen_ids.add(bc_id)

        name = row.get("bc_short_name", "").strip()
        categories = row.get("bc_categories", "").strip()
        synonyms = row.get("bc_synonyms", "").strip()
        definition = row.get("bc_definition", "").strip()
        parent_id = row.get("parent_bc_id", "").strip()
        result_scales = row.get("result_scales", "").strip()
        dec_n = row.get("dec_n", "").strip()

        if not name:
            continue

        # Skip very generic/abstract concepts
        skip_names = {
            "Agent", "Algorithm", "Applicant", "Analysis",
            "Abnormal Finding", "Abnormal Indicator",
            "Active Comparator", "Age", "Age Started",
        }
        if name in skip_names:
            continue

        sdtm_domain = resolve_sdtm_domain(categories, synonyms)
        ui_category = resolve_ui_category(categories, sdtm_domain)

        procedure_bcs.append({
            "id": f"bc-{bc_id}",
            "name": name,
            "nciCode": bc_id,
            "definition": definition[:300] if definition else "",
            "cdiscCategories": [c.strip() for c in categories.split(";") if c.strip()] if categories else [],
            "synonyms": [s.strip() for s in synonyms.split(";") if s.strip()] if synonyms else [],
            "sdtmDomain": sdtm_domain,
            "uiCategory": ui_category,
            "hierarchyLevel": level,
            "parentId": parent_id if parent_id else None,
            "resultScales": result_scales,
            "source": "CDISC COSMoS",
        })

    print(f"  Extracted {len(procedure_bcs)} procedure-level BCs (levels 0-1)")

    # -----------------------------------------------------------------------
    # 3. Download and parse SDTM Dataset Specializations
    # -----------------------------------------------------------------------
    print("\n[3/4] Downloading SDTM Dataset Specializations...")
    sdtm_rows = download_csv(SDTM_SPECIALIZATIONS_URL)
    print(f"  Downloaded {len(sdtm_rows)} SDTM specialization entries")

    # Extract unique domain + vlm_group_id + short_name combinations
    seen_specs = set()
    sdtm_activities = []

    for row in sdtm_rows:
        domain = row.get("domain", "").strip()
        vlm_group = row.get("vlm_group_id", "").strip()
        short_name = row.get("short_name", "").strip()
        bc_id = row.get("bc_id", "").strip()

        if not domain or not vlm_group or not short_name:
            continue

        spec_key = f"{domain}-{vlm_group}"
        if spec_key in seen_specs:
            continue
        seen_specs.add(spec_key)

        ui_category = DOMAIN_TO_CATEGORY.get(domain, "CLINICAL")

        sdtm_activities.append({
            "id": f"sdtm-{domain}-{vlm_group}",
            "name": short_name,
            "nciCode": bc_id if bc_id else None,
            "definition": f"SDTM {domain} domain: {short_name}",
            "cdiscCategories": [f"SDTM {domain}"],
            "synonyms": [vlm_group],
            "sdtmDomain": domain,
            "uiCategory": ui_category,
            "hierarchyLevel": None,
            "parentId": None,
            "resultScales": "",
            "source": "CDISC SDTM Dataset Specialization",
        })

    print(f"  Extracted {len(sdtm_activities)} unique SDTM specialization activities")

    # -----------------------------------------------------------------------
    # 4. Merge, deduplicate, and output
    # -----------------------------------------------------------------------
    print("\n[4/4] Merging and generating catalog...")

    # Merge: BCs first, then SDTM specializations (avoiding duplicates by name+domain)
    all_activities = []
    seen_name_domain = set()

    for act in procedure_bcs:
        key = (act["name"].lower(), act["sdtmDomain"])
        if key not in seen_name_domain:
            seen_name_domain.add(key)
            all_activities.append(act)

    for act in sdtm_activities:
        key = (act["name"].lower(), act["sdtmDomain"])
        if key not in seen_name_domain:
            seen_name_domain.add(key)
            all_activities.append(act)

    # Sort by UI category, then name
    category_order = [
        "ADMIN", "CLINICAL", "LABORATORY", "IMAGING",
        "EFFICACY", "SAFETY", "PK", "TREATMENT", "PRO",
    ]
    all_activities.sort(key=lambda a: (
        category_order.index(a["uiCategory"]) if a["uiCategory"] in category_order else 99,
        a["name"].lower(),
    ))

    # Build category summary
    category_counts = defaultdict(int)
    for act in all_activities:
        category_counts[act["uiCategory"]] += 1

    # Build scheduling patterns from the activities
    # These are generated from the catalog itself
    patterns = _build_scheduling_patterns(all_activities)

    # Assemble final output
    catalog = {
        "_meta": {
            "description": "Activity catalog generated from CDISC COSMoS Biomedical Concepts",
            "source": "https://github.com/cdisc-org/COSMoS",
            "bcHierarchyUrl": BC_HIERARCHY_URL,
            "sdtmSpecializationsUrl": SDTM_SPECIALIZATIONS_URL,
            "totalActivities": len(all_activities),
            "categoryCounts": dict(category_counts),
        },
        "activities": all_activities,
        "schedulingPatterns": patterns,
    }

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    print(f"\n  Written {len(all_activities)} activities to {OUTPUT_FILE}")
    print(f"  Category breakdown:")
    for cat in category_order:
        count = category_counts.get(cat, 0)
        if count > 0:
            print(f"    {cat:12s}: {count}")
    print(f"  Scheduling patterns: {len(patterns)}")
    print("\nDone!")


def _build_scheduling_patterns(activities: list[dict]) -> list[dict]:
    """Generate scheduling patterns from the activity catalog."""
    # Index activities by name keywords for pattern matching
    by_name = {a["name"].lower(): a["id"] for a in activities}
    by_domain = defaultdict(list)
    for a in activities:
        if a["sdtmDomain"]:
            by_domain[a["sdtmDomain"]].append(a["id"])

    def find_ids(*keywords):
        """Find activity IDs matching any of the given keywords."""
        ids = []
        for kw in keywords:
            kw_lower = kw.lower()
            for name, aid in by_name.items():
                if kw_lower in name:
                    ids.append(aid)
                    break
        return ids

    patterns = []

    # Pattern 1: Screening Visit
    screening_ids = find_ids(
        "Informed Consent", "Demographics", "Medical History",
        "Vital Signs", "Physical Examination", "Hematology",
        "Clinical Chemistry", "Urinalysis", "Adverse Event",
        "Electrocardiogram", "Pregnancy Test",
    )
    # Also add from domains
    screening_ids.extend(by_domain.get("IE", [])[:1])  # Inclusion/Exclusion
    screening_ids = list(dict.fromkeys(screening_ids))  # dedupe preserving order

    if screening_ids:
        patterns.append({
            "id": "pattern-screening",
            "name": "Standard Screening Visit",
            "description": "Common screening activities: consent, demographics, medical history, labs, vitals, ECG",
            "epochType": "SCREENING",
            "activityIds": screening_ids,
        })

    # Pattern 2: Baseline Assessment
    baseline_ids = find_ids(
        "Vital Signs", "Physical Examination", "Hematology",
        "Clinical Chemistry", "Electrocardiogram", "Adverse Event",
        "Concomitant Medication", "Body Mass Index", "ECOG",
    )
    baseline_ids.extend(by_domain.get("TU", [])[:1])  # Tumor assessment
    baseline_ids = list(dict.fromkeys(baseline_ids))

    if baseline_ids:
        patterns.append({
            "id": "pattern-baseline",
            "name": "Baseline Assessment",
            "description": "Comprehensive baseline: vitals, PE, labs, ECG, tumor assessment",
            "epochType": "TREATMENT",
            "activityIds": baseline_ids,
        })

    # Pattern 3: Routine Safety
    safety_ids = find_ids(
        "Vital Signs", "Adverse Event", "Concomitant Medication",
        "Hematology", "Clinical Chemistry",
    )
    safety_ids = list(dict.fromkeys(safety_ids))

    if safety_ids:
        patterns.append({
            "id": "pattern-routine-safety",
            "name": "Routine Safety Monitoring",
            "description": "Standard safety: vitals, AEs, concomitant meds, labs",
            "epochType": "TREATMENT",
            "activityIds": safety_ids,
        })

    # Pattern 4: Oncology Efficacy
    efficacy_ids = find_ids(
        "Tumor Assessment", "Disease Response", "Target Lesion",
        "Best Overall Response",
    )
    efficacy_ids.extend(by_domain.get("TU", [])[:2])
    efficacy_ids.extend(by_domain.get("RS", [])[:2])
    efficacy_ids = list(dict.fromkeys(efficacy_ids))

    if efficacy_ids:
        patterns.append({
            "id": "pattern-efficacy-oncology",
            "name": "Oncology Efficacy Assessment",
            "description": "Tumor assessment and disease response evaluation",
            "epochType": "TREATMENT",
            "activityIds": efficacy_ids,
        })

    # Pattern 5: PK Sampling
    pk_ids = by_domain.get("PC", [])[:3]
    pk_ids.extend(find_ids("Vital Signs"))
    pk_ids = list(dict.fromkeys(pk_ids))

    if pk_ids:
        patterns.append({
            "id": "pattern-pk-sampling",
            "name": "PK Sampling Visit",
            "description": "Pharmacokinetic blood sampling with vitals",
            "epochType": "TREATMENT",
            "activityIds": pk_ids,
        })

    # Pattern 6: Follow-up
    followup_ids = find_ids(
        "Vital Signs", "Adverse Event", "Concomitant Medication",
        "Physical Examination",
    )
    followup_ids.extend(by_domain.get("RS", [])[:1])
    followup_ids = list(dict.fromkeys(followup_ids))

    if followup_ids:
        patterns.append({
            "id": "pattern-followup",
            "name": "Follow-up Visit",
            "description": "Post-treatment follow-up: vitals, AEs, response assessment",
            "epochType": "FOLLOW_UP",
            "activityIds": followup_ids,
        })

    return patterns


if __name__ == "__main__":
    build_catalog()
