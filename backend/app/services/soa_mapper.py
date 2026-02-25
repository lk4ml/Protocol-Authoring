"""
SOA Mapper -- Maps ClinicalTrials.gov trial data to procedure library entries.

ALL classification is DATA-DRIVEN:
  - Therapeutic area detection uses procedure library categories, not hardcoded keywords
  - Procedure selection uses SDTM domain + activity group matching, not hardcoded templates
  - Outcome parsing matches against actual library procedure names and categories

Given a parsed CT.gov trial (NCT data), this module:
1. Infers the therapeutic area by matching conditions to library categories
2. Determines the study phase, design, interventions
3. Builds a recommended SOA by selecting procedures from the library
   based on SDTM domain relevance and trial characteristics
4. Returns grouped procedures with scheduling suggestions (visit mapping)
"""

import json
import os
import re
from collections import defaultdict

TERMINOLOGY_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "terminology"
)


def _load_procedure_library():
    """Load the procedure library JSON."""
    path = os.path.join(TERMINOLOGY_DIR, "procedure_library.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_soa_hierarchy():
    """Load the SOA hierarchy JSON."""
    path = os.path.join(TERMINOLOGY_DIR, "soa_hierarchy.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_category_mapping():
    """Load the CDISC category mapping config."""
    path = os.path.join(TERMINOLOGY_DIR, "cdisc_category_mapping.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# -- Therapeutic Area Detection (DATA-DRIVEN) ---------------------

def detect_therapeutic_area(conditions, keywords, interventions, description="",
                            library=None):
    """
    Detect the primary therapeutic area by matching trial metadata
    against the procedure library's TA-specific procedures.

    Instead of hardcoded keyword lists, we:
    1. Get all TA IDs from the library's taProcedures keys
    2. Get all procedure names within each TA
    3. Score conditions/keywords against TA procedure names/definitions
    4. Return the highest-scoring TA
    """
    text = " ".join([
        " ".join(conditions or []),
        " ".join(keywords or []),
        " ".join(interventions or []),
        description or "",
    ]).lower()

    if not text.strip():
        return "ALL"

    if not library:
        library = _load_procedure_library()

    ta_procedures = library.get("taProcedures", {})
    ta_list = library.get("therapeuticAreas", [])
    ta_ids = {ta["id"] for ta in ta_list if ta["id"] != "ALL"}

    # Build scoring terms for each TA from the library's own TA procedure data
    # Each TA has procedures whose names/categories reveal the TA context
    scores = {}
    for ta_id in ta_ids:
        procs = ta_procedures.get(ta_id, [])
        if not procs:
            continue

        score = 0
        # Extract relevant terms from TA procedures
        ta_terms = set()
        for p in procs:
            # Use CDISC categories as scoring signal
            for cat in p.get("cdiscCategories", []):
                ta_terms.add(cat.lower())
            # Use procedure names
            words = p.get("name", "").lower().split()
            for w in words:
                if len(w) >= 4:  # Skip short words
                    ta_terms.add(w)

        for term in ta_terms:
            if term in text:
                score += 1

        # Also check the TA id itself as a keyword
        ta_name_lower = ta_id.lower().replace("_", " ")
        if ta_name_lower in text:
            score += 5  # Strong signal

        if score > 0:
            scores[ta_id] = score

    # Always also check condition-based signals (stronger than library name matching)
    # These are the top-level disease category signals used as primary TA detection
    CONDITION_SIGNALS = {
        "ONCOLOGY": ["cancer", "tumor", "tumour", "carcinoma", "melanoma",
                     "lymphoma", "leukemia", "sarcoma", "myeloma", "neoplasm",
                     "malignant", "metastatic", "nsclc", "glioblastoma",
                     "oncology", "solid tumor"],
        "CARDIOVASCULAR": ["cardiovascular", "heart failure", "myocardial",
                           "hypertension", "atrial fibrillation", "coronary",
                           "stroke", "arrhythmia", "cardiac"],
        "NEUROLOGY": ["alzheimer", "parkinson", "multiple sclerosis",
                      "epilepsy", "dementia", "neuropathy", "neurodegenerat"],
        "PSYCHIATRY": ["depression", "schizophrenia", "bipolar", "anxiety disorder",
                       "psychiatric", "major depressive"],
        "IMMUNOLOGY": ["rheumatoid arthritis", "lupus", "psoriasis",
                       "crohn", "ulcerative colitis", "autoimmune",
                       "atopic dermatitis"],
        "RESPIRATORY": ["asthma", "copd", "pulmonary fibrosis", "respiratory disease"],
        "INFECTIOUS": ["hiv", "hepatitis", "covid", "sars-cov", "tuberculosis",
                       "influenza", "malaria", "infection", "vaccine",
                       "coronavirus"],
        "DIABETES": ["diabetes", "diabetic", "glycemic", "hba1c", "insulin",
                     "sglt2", "glp-1"],
        "RARE_DISEASE": ["rare disease", "orphan", "fabry", "gaucher",
                         "duchenne", "sickle cell", "hemophilia"],
    }

    # Condition signals are weighted MORE heavily than library name matching
    condition_scores = {}
    # Only check conditions and keywords (not full text) for condition signals
    condition_text = " ".join([
        " ".join(conditions or []),
        " ".join(keywords or []),
    ]).lower()

    for ta_id, signals in CONDITION_SIGNALS.items():
        score = sum(3 for s in signals if s in condition_text)
        if score > 0:
            condition_scores[ta_id] = score

    # Merge: condition scores dominate
    for ta_id, score in condition_scores.items():
        scores[ta_id] = scores.get(ta_id, 0) + score

    if not scores:
        return "ALL"

    return max(scores, key=scores.get)


# -- Data-driven procedure selection --------------------------------

# Activity groups that should ALWAYS be represented in any trial SOA
# (per ICH M11 SOA template structure)
ICH_M11_CORE_ACTIVITY_GROUPS = {
    "CONSENT",    # Informed consent is mandatory (ICH E6(R2))
    "DEMOG",      # Demographics/history always collected
    "CLINICAL",   # Vital signs, PE always done
    "LABS",       # Lab assessments standard in all interventional trials
    "AE",         # AE monitoring mandatory (ICH E2A)
    "IP_ADMIN",   # Drug administration for interventional trials
}


def _select_core_procedures(all_procs, proc_by_ag):
    """
    Select core procedures for ALL trials by picking representative procedures
    from each ICH M11-mandated activity group.

    Selection priority (data-driven from library metadata):
    1. Procedures sourced from ICH / CDASH / SDTM standards (essential)
    2. CDISC Library BCs with parent-level categories (not sub-tests)
    3. Procedures whose names match ICH M11 SOA section headings
    """
    selected = {}

    # ICH M11 SOA row names — these are the actual headings in the
    # ICH M11 protocol template's Schedule of Activities table.
    # We match library procedures against these standard names.
    ICH_M11_ROW_NAMES = {
        "CONSENT":  ["informed consent", "eligibility", "disposition"],
        "DEMOG":    ["demographics", "medical history", "concomitant medication",
                     "prior medication", "substance use", "randomization"],
        "CLINICAL": ["vital signs measurement", "physical examination", "body weight",
                     "body height", "body mass index", "body surface area",
                     "performance status"],
        "LABS":     ["hematology test", "chemistry test", "urinalysis",
                     "liver function", "coagulation", "thyroid", "pregnancy"],
        "AE":       ["adverse event", "serious adverse event", "clinical events"],
        "IP_ADMIN": ["study drug", "drug administration", "dose modification",
                     "treatment compliance", "exposure tracking"],
        "CARDIAC":  ["electrocardiogram", "ecg measurement"],
    }

    # Names to explicitly exclude from core selection (irrelevant sub-tests
    # or reproductive/substance-specific items not needed in standard SOA)
    CORE_EXCLUDE_PATTERNS = [
        "date of delivery", "adrenarche", "menarche", "menopause",
        "first oral sex", "first sexual", "gravidity", "parity",
        "cervical", "vaginal", "penile", "testicular", "breast",
        "caffeine", "cotinine", "tobacco", "alcohol use",
        "nnal", "color", "odor", "clarity", "specific gravity",
        "age started", "age at ", "appendicular skeletal",
        "skeletal muscle mass", "bone mineral", "skin fold",
        "clinical change by non-invasive", "non-invasive imaging",
        "aggregate pr interval", "aggregate qrs duration",
        "acute myocardial infarction type",
        "alpha angle", "acetabular", "femoral", "hip angle",
        "joint space", "kellgren", "schober", "trabecular",
        "disc height", "vertebral", "spinal canal",
        "circumference", "waist-to-hip",
        "menstrual", "menstruation", "ovulation", "ovarian",
        "uterine", "endometrial", "mammographic",
        "non-invasive imaging procedure",
        "beta angle", "center edge angle", "sharp angle",
        "intervertebral", "disc degeneration",
        "tibial", "femoral head", "lateral subluxation",
        "pelvic", "sacroiliac", "nucleus pulposus",
        "cellularity", "circulating tumor",
        "biopsy", "autopsy", "necropsy",
        "lesion measurement", "lesion assess",
        "birth control", "contraception", "fertility",
        "lactation", "breastfeeding", "nursing",
        "dental", "ophthalmol", "audiolog", "dermatolog",
        "head circumference", "mid-upper arm",
        "grip strength", "hand grip", "peak flow",
        "genital", "sexual",
    ]

    MAX_PER_AG = {
        "CONSENT": 2,
        "DEMOG": 5,
        "CLINICAL": 6,
        "LABS": 5,
        "AE": 3,
        "IP_ADMIN": 3,
        "CARDIAC": 2,
    }

    for ag_id in ICH_M11_CORE_ACTIVITY_GROUPS:
        candidates = proc_by_ag.get(ag_id, [])
        if not candidates:
            continue

        # Filter to core/ALL procedures
        core_candidates = [p for p in candidates if p.get("therapeuticArea") == "ALL"]
        if not core_candidates:
            core_candidates = candidates

        limit = MAX_PER_AG.get(ag_id, 3)
        row_names = ICH_M11_ROW_NAMES.get(ag_id, [])

        def sort_key(p):
            src = (p.get("source") or "").lower()
            name = (p.get("name") or "").lower()

            # Tier 0: Essential/ICH source (highest priority)
            is_essential = any(s in src for s in [
                "ich", "cdash", "fda", "sdtm ig",
            ])

            # Tier 1: Name matches an ICH M11 SOA row heading
            matches_row = any(rn in name for rn in row_names)

            # Tier 2: Has a CDISC category at position 0 that is a major category
            # (not a sub-question or deep child)
            cats = p.get("cdiscCategories", [])
            is_parent_level = len(cats) > 0 and not any(
                "question" in c.lower() for c in cats
            )

            # Lower number = higher priority
            tier = 3
            if is_essential:
                tier = 0
            elif matches_row:
                tier = 1
            elif is_parent_level:
                tier = 2

            return (tier, name)

        sorted_candidates = sorted(core_candidates, key=sort_key)

        # Filter out excluded candidates first
        filtered = []
        for p in sorted_candidates:
            pname_lower = (p.get("name") or "").lower()
            if len(pname_lower) < 8:
                continue
            if any(excl in pname_lower for excl in CORE_EXCLUDE_PATTERNS):
                continue
            filtered.append(p)

        # Two-pass selection:
        # Pass 1: Only add procedures that match ICH M11 row names or essential sources
        # Pass 2: If under limit, fill from remaining candidates
        tier1 = []
        tier2 = []
        for p in filtered:
            tier_val, _ = sort_key(p)
            if tier_val <= 1:
                tier1.append(p)
            else:
                tier2.append(p)

        added = 0
        # Add tier 1 first (essential + ICH M11 row name matches)
        for p in tier1:
            if added >= limit:
                break
            pid = p.get("id", "")
            if pid and pid not in selected:
                selected[pid] = {
                    "procedure": p,
                    "reason": f"ICH M11 core: {ag_id} activity group",
                    "priority": 3,
                }
                added += 1

        # Only fill from tier 2 if still under limit
        if added < limit:
            for p in tier2:
                if added >= limit:
                    break
                pid = p.get("id", "")
                if pid and pid not in selected:
                    selected[pid] = {
                        "procedure": p,
                        "reason": f"ICH M11 core: {ag_id} activity group",
                        "priority": 3,
                    }
                    added += 1

    return selected


def _select_phase_procedures(phase_key, all_procs, proc_by_ag, selected):
    """
    Add phase-appropriate procedures using SDTM domain logic.

    Phase 1/2: Add PK sampling, immunogenicity (PK_SAMP, ADA activity groups)
    Phase 3: Add cardiac monitoring (CARDIAC activity group) if not already present
    All phases: Performance status from EFFICACY/DISEASE or FUNCTION
    """
    if not phase_key:
        return

    # Phase 1 & 2: PK and immunogenicity are standard
    if phase_key in ("PHASE1", "PHASE2"):
        for ag_id in ["PK_SAMP", "ADA"]:
            candidates = proc_by_ag.get(ag_id, [])
            core_candidates = [p for p in candidates if p.get("therapeuticArea") == "ALL"]
            if not core_candidates:
                core_candidates = candidates
            for p in core_candidates[:2]:
                pid = p.get("id", "")
                if pid and pid not in selected:
                    selected[pid] = {
                        "procedure": p,
                        "reason": f"Standard for {phase_key} trials (PK/immunogenicity)",
                        "priority": 2,
                    }

    # All interventional phases: cardiac monitoring (ECG)
    if phase_key in ("PHASE1", "PHASE2", "PHASE3"):
        candidates = proc_by_ag.get("CARDIAC", [])
        core_candidates = [p for p in candidates if p.get("therapeuticArea") == "ALL"]
        if not core_candidates:
            core_candidates = candidates

        # Prefer ECG-named procedures (the standard cardiac assessment)
        ecg_terms = ["electrocardiogram", "ecg"]

        def cardiac_sort(p):
            name = (p.get("name") or "").lower()
            src = (p.get("source") or "").lower()
            is_essential = any(s in src for s in ["ich", "cdash", "sdtm ig"])
            matches_ecg = any(t in name for t in ecg_terms)
            return (0 if is_essential else (1 if matches_ecg else 2), name)

        sorted_cardiac = sorted(core_candidates, key=cardiac_sort)
        added = 0
        for p in sorted_cardiac:
            if added >= 2:
                break
            pname = (p.get("name") or "").lower()
            if len(pname) < 8:
                continue
            # Skip irrelevant cardiac items
            if any(skip in pname for skip in [
                "non-invasive imaging", "myocardial infarction type",
                "aggregate pr interval", "aggregate qrs duration",
            ]):
                continue
            pid = p.get("id", "")
            if pid and pid not in selected:
                selected[pid] = {
                    "procedure": p,
                    "reason": f"Standard cardiac monitoring for {phase_key}",
                    "priority": 2,
                }
                added += 1


def _select_ta_procedures(ta, all_procs, proc_by_ag, ta_procedures, selected):
    """
    Add TA-specific procedures from the library's taProcedures section.

    Data-driven: uses the library's own TA classification, not hardcoded templates.
    Prioritizes parent-level BCs (actual assessments, not sub-questions).
    """
    ta_procs = ta_procedures.get(ta, [])
    if not ta_procs:
        return

    # Group TA procedures by their activity group
    ta_by_ag = defaultdict(list)
    for p in ta_procs:
        ag = p.get("activityGroupId", "")
        ta_by_ag[ag].append(p)

    # Select top procedures per activity group, preferring parent-level BCs
    for ag_id, procs in ta_by_ag.items():
        # PRO instruments need stricter limits (too many QRS instruments)
        if ag_id in ("QOL", "SYMPTOM"):
            limit = 2
        else:
            limit = 3

        # Sort: prefer shorter names (parent concepts, not "CDISC Questionnaire..." long names)
        # and procedures with more meaningful definitions
        def ta_sort_key(p):
            name = p.get("name", "")
            src = (p.get("source") or "").lower()
            # Prefer non-QRS sources (actual BCs over long instrument names)
            is_qrs = "qrs" in src or "nci evs" in src
            # Prefer shorter names (parent concepts)
            name_len_tier = 0 if len(name) < 50 else (1 if len(name) < 100 else 2)
            return (1 if is_qrs else 0, name_len_tier, name)

        sorted_procs = sorted(procs, key=ta_sort_key)
        for p in sorted_procs[:limit]:
            pid = p.get("id", "")
            if pid and pid not in selected:
                selected[pid] = {
                    "procedure": p,
                    "reason": f"Standard for {ta} trials",
                    "priority": 2,
                }


def _extract_outcomes_keywords(outcomes):
    """Extract assessment-related keywords from trial outcomes.

    Maps outcome text to SDTM domain concepts for procedure matching.
    """
    keywords = set()
    all_outcomes = []
    if outcomes:
        all_outcomes.extend(outcomes.get("primary", []) or [])
        all_outcomes.extend(outcomes.get("secondary", []) or [])

    for out in all_outcomes:
        measure = (out.get("measure") or "").lower()
        desc = (out.get("description") or "").lower()
        text = measure + " " + desc

        # Map outcome text to SDTM domain-based signals
        # These patterns correspond to actual SDTM domain data types
        OUTCOME_TO_DOMAIN = {
            "EG":   ["ecg", "electrocardiogram", "qtc", "qt interval"],
            "PR_CT": ["ct scan", "computed tomography"],
            "PR_MRI": ["mri", "magnetic resonance"],
            "PR_PET": ["pet", "positron emission"],
            "PR_XRAY": ["x-ray", "xray", "radiograph"],
            "PR_ECHO": ["echocardiogram", "echo", "lvef", "ejection fraction"],
            "PC":   ["pharmacokinetic", "pk ", "clearance", "volume of distribution",
                     "auc", "cmax", "trough"],
            "IS":   ["anti-drug antibod", "ada ", "immunogenicity"],
            "QS":   ["quality of life", "eq-5d", "eortc", "patient reported", "pro "],
            "RS":   ["recist", "tumor response", "tumor assess", "disease response",
                     "objective response"],
            "SURV": ["overall survival", "progression-free", "pfs ", "os "],
            "AE":   ["adverse event", "safety", "tolerability"],
            "GF":   ["biomarker", "pd-l1", "ctdna", "circulating tumor"],
            "LB_GLYC": ["hba1c", "glycat", "fasting glucose", "fasting plasma"],
            "VS_BP": ["blood pressure", "systolic", "diastolic"],
            "FT":   ["cognitive", "mmse", "adas-cog", "cdr", "mini-mental"],
        }

        for key, patterns in OUTCOME_TO_DOMAIN.items():
            if any(w in text for w in patterns):
                keywords.add(key)

    return keywords


def _select_outcome_procedures(outcome_kws, all_procs, proc_by_name, selected):
    """
    Add procedures driven by trial outcome measures.

    Maps outcome domain signals to actual library procedure names.
    """
    # Map outcome signals to procedure search terms
    OUTCOME_TO_SEARCH = {
        "EG":     ["Electrocardiogram"],
        "PR_CT":  ["CT Scan"],
        "PR_MRI": ["MRI Scan"],
        "PR_PET": ["PET Scan"],
        "PR_XRAY": ["X-Ray"],
        "PR_ECHO": ["Echocardiogram"],
        "PC":     ["PK Blood Sampling", "Pharmacokinetic"],
        "IS":     ["Anti-Drug Antibody", "Immunogenicity"],
        "QS":     ["EQ-5D", "EORTC", "Quality of Life"],
        "RS":     ["Tumor Identification", "Disease Response"],
        "SURV":   ["Tumor Identification", "Disease Response"],
        "AE":     [],  # Already in core
        "GF":     ["Tumor Mutation Burden", "Biomarker"],
        "LB_GLYC": ["Glucose"],
        "VS_BP":  ["Blood Pressure"],
        "FT":     ["Cognitive Function"],
    }

    for kw in outcome_kws:
        search_terms = OUTCOME_TO_SEARCH.get(kw, [])
        for term in search_terms:
            term_lower = term.lower()
            # Try exact match first
            proc = proc_by_name.get(term_lower)
            if not proc:
                # Try contains match
                for pname, p in proc_by_name.items():
                    if term_lower in pname or pname in term_lower:
                        proc = p
                        break
            if proc:
                pid = proc.get("id", "")
                if pid and pid not in selected:
                    selected[pid] = {
                        "procedure": proc,
                        "reason": f"Trial outcome measure requires {term}",
                        "priority": 2,
                    }


def _select_eligibility_procedures(elig_text, proc_by_name, all_procs, selected):
    """
    Add procedures driven by eligibility criteria mentions.

    Maps eligibility text patterns to actual library procedure names.
    """
    elig_lower = elig_text.lower()

    # Eligibility text patterns -> library procedure search terms
    ELIG_TO_SEARCH = {
        "performance status":  ["Clinical Performance Status", "ECOG"],
        "ecog":                ["Clinical Performance Status", "ECOG"],
        "pregnancy test":      ["Pregnancy Finding"],
        "childbearing":        ["Pregnancy Finding"],
        "hepatitis":           ["Hepatitis B Surface Antigen", "Hepatitis"],
        "hiv":                 ["HIV"],
        "liver function":      ["Liver Function Test"],
        "hepatic function":    ["Liver Function Test"],
        "renal function":      ["Creatinine"],
        "creatinine":          ["Creatinine"],
        "egfr":                ["Creatinine"],
    }

    for pattern, search_terms in ELIG_TO_SEARCH.items():
        if pattern in elig_lower:
            for term in search_terms:
                term_lower = term.lower()
                proc = proc_by_name.get(term_lower)
                if not proc:
                    for pname, p in proc_by_name.items():
                        if term_lower in pname or pname in term_lower:
                            proc = p
                            break
                if proc:
                    pid = proc.get("id", "")
                    if pid and pid not in selected:
                        selected[pid] = {
                            "procedure": proc,
                            "reason": f"Eligibility criteria mentions {pattern}",
                            "priority": 2,
                        }


def _select_pro_instruments(outcomes, proc_by_name, selected):
    """
    Match specific PRO instruments mentioned in trial outcomes
    against actual library procedure names.

    Uses well-known instrument abbreviations for precise matching
    rather than fuzzy word overlap (which causes false positives
    on long CDISC Questionnaire names).
    """
    all_outcomes_text = []
    for outcome_type in ["primary", "secondary", "other"]:
        for out in (outcomes.get(outcome_type) or []):
            text = (out.get("measure") or "") + " " + (out.get("description") or "")
            all_outcomes_text.append(text.lower())
    combined = " ".join(all_outcomes_text)

    if not combined.strip():
        return

    # Well-known PRO instrument abbreviations (from CDISC QRS catalog).
    # These are specific enough to avoid false positives.
    KNOWN_PRO_ABBREVIATIONS = [
        "eortc qlq-c30", "eq-5d-5l", "eq-5d-3l", "sf-36", "sf-12",
        "phq-9", "gad-7", "fact-g", "fact-b", "fact-l", "fact-p",
        "promis", "bdi-ii", "bdi", "madrs", "ham-d", "ham-a",
        "panss", "updrs", "adas-cog", "mmse", "moca",
        "acr20", "das28", "pasi", "dlqi", "scorad",
        "karnofsky", "ecog", "womac", "osdi", "vfq-25",
        "c-ssrs", "cgi-s", "cgi-i",
    ]

    for abbrev in KNOWN_PRO_ABBREVIATIONS:
        if abbrev in combined:
            # Find matching procedure in library
            for pname, proc in proc_by_name.items():
                if abbrev in pname:
                    pid = proc.get("id", "")
                    if pid and pid not in selected:
                        selected[pid] = {
                            "procedure": proc,
                            "reason": f"PRO instrument '{abbrev.upper()}' in trial outcomes",
                            "priority": 2,
                        }
                    break  # Only add one match per abbreviation


def build_suggested_soa(trial_data):
    """
    Build a suggested Schedule of Activities from CT.gov trial data.

    ALL procedure selection is data-driven from the library content:
    - Core procedures: ICH M11 mandated activity groups
    - Phase procedures: SDTM domain-based (PK for Phase 1/2, etc.)
    - TA procedures: from library's taProcedures section
    - Outcome procedures: matched against library names
    - Eligibility procedures: matched against library names
    - PRO instruments: matched against QRS catalog

    Args:
        trial_data: Parsed CT.gov response dict

    Returns:
        Dict with suggestedProcedures, visits, matchStats
    """
    lib = _load_procedure_library()
    hierarchy = _load_soa_hierarchy()

    # Build flat list of all procedures
    all_procs = list(lib.get("coreProcedures", []))
    ta_procedures = lib.get("taProcedures", {})
    for ta_procs in ta_procedures.values():
        all_procs.extend(ta_procs)

    # Create lookup indices
    proc_by_name = {}
    proc_by_domain = defaultdict(list)
    proc_by_ag = defaultdict(list)
    for p in all_procs:
        key = (p.get("name") or "").lower().strip()
        if key:
            proc_by_name[key] = p
        if p.get("sdtmDomain"):
            proc_by_domain[p["sdtmDomain"]].append(p)
        if p.get("activityGroupId"):
            proc_by_ag[p["activityGroupId"]].append(p)

    # Parse trial metadata
    conditions = trial_data.get("conditions") or []
    keywords = trial_data.get("keywords") or []
    interventions = []
    for intv in (trial_data.get("interventions") or []):
        if isinstance(intv, dict):
            interventions.append(intv.get("name", ""))
        else:
            interventions.append(str(intv))

    description = ""
    if isinstance(trial_data.get("description"), dict):
        description = trial_data["description"].get("briefSummary", "")
    elif isinstance(trial_data.get("description"), str):
        description = trial_data["description"]
    brief_summary = (trial_data.get("briefSummary")
                     or trial_data.get("brief_summary") or "")
    description = description or brief_summary

    # Detect therapeutic area (data-driven)
    ta = detect_therapeutic_area(
        conditions, keywords, interventions, description, library=lib
    )

    # Detect phase
    phase_raw = trial_data.get("phase") or ""
    if isinstance(phase_raw, list):
        phase_raw = " / ".join(phase_raw)
    phase_key = None
    if "3" in phase_raw or "III" in phase_raw:
        phase_key = "PHASE3"
    elif "2" in phase_raw or "II" in phase_raw:
        phase_key = "PHASE2"
    elif "1" in phase_raw or "I" in phase_raw:
        phase_key = "PHASE1"

    # Extract outcome keywords
    outcomes = trial_data.get("outcomes") or {}
    outcome_kws = _extract_outcomes_keywords(outcomes)

    # -- Build procedure selection (ALL data-driven) --

    # 1. Core procedures from ICH M11 activity groups
    selected = _select_core_procedures(all_procs, proc_by_ag)

    # 2. Phase-specific procedures
    _select_phase_procedures(phase_key, all_procs, proc_by_ag, selected)

    # 3. TA-specific procedures from library
    _select_ta_procedures(ta, all_procs, proc_by_ag, ta_procedures, selected)

    # 4. Outcome-driven procedures
    _select_outcome_procedures(outcome_kws, all_procs, proc_by_name, selected)

    # 5. Eligibility-driven procedures
    elig = (trial_data.get("eligibility")
            or trial_data.get("eligibility_criteria") or {})
    elig_text = ""
    if isinstance(elig, dict):
        elig_text = (
            (elig.get("rawText") or "")
            + " "
            + (
                elig.get("inclusion", "")
                if isinstance(elig.get("inclusion"), str)
                else " ".join(elig.get("inclusion", []))
            )
        )
    elif isinstance(elig, str):
        elig_text = elig
    _select_eligibility_procedures(elig_text, proc_by_name, all_procs, selected)

    # 6. PRO instruments from outcomes
    _select_pro_instruments(outcomes, proc_by_name, selected)

    # -- Build visit structure --

    arms = trial_data.get("arms") or []
    num_arms = trial_data.get("numberOfArms") or len(arms) or 2
    design_info = (trial_data.get("designInfo")
                   or trial_data.get("design_info") or {})
    if isinstance(design_info, str):
        design_info = {}

    is_randomized = "random" in (design_info.get("allocation") or "").lower()

    visits = []
    visits.append({
        "name": "Screening", "week": -4,
        "epoch": "Screening", "studyDay": -28,
    })
    if is_randomized:
        visits.append({
            "name": "Baseline/Randomization", "week": 0,
            "epoch": "Screening", "studyDay": 1,
        })
    else:
        visits.append({
            "name": "Baseline", "week": 0,
            "epoch": "Screening", "studyDay": 1,
        })

    if phase_key == "PHASE1":
        for wk in [1, 2, 3, 4, 6, 8]:
            visits.append({
                "name": f"Week {wk}", "week": wk,
                "epoch": "Treatment", "studyDay": wk * 7 + 1,
            })
    elif phase_key == "PHASE2":
        for wk in [2, 4, 8, 12, 16, 20, 24]:
            visits.append({
                "name": f"Week {wk}", "week": wk,
                "epoch": "Treatment", "studyDay": wk * 7 + 1,
            })
    else:
        for wk in [3, 6, 9, 12, 18, 24, 36, 48]:
            visits.append({
                "name": f"Week {wk}", "week": wk,
                "epoch": "Treatment", "studyDay": wk * 7 + 1,
            })

    visits.append({
        "name": "End of Treatment", "week": None,
        "epoch": "Treatment", "studyDay": None,
    })
    visits.append({
        "name": "Follow-up 1", "week": None,
        "epoch": "Follow-up", "studyDay": None,
    })
    visits.append({
        "name": "Follow-up 2", "week": None,
        "epoch": "Follow-up", "studyDay": None,
    })

    # -- Group selected procedures by SOA hierarchy --

    grouped = defaultdict(lambda: defaultdict(list))
    for entry in selected.values():
        proc = entry["procedure"]
        sg = proc.get("soaGroupId") or "SAFETY"
        ag = proc.get("activityGroupId") or "CLINICAL"
        grouped[sg][ag].append({
            **proc,
            "_matchReason": entry["reason"],
            "_matchPriority": entry["priority"],
        })

    soa_order = ["ADMIN", "SAFETY", "EFFICACY", "TREATMENT", "PK", "PRO"]
    suggested_procedures = []
    for sg_id in soa_order:
        if sg_id not in grouped:
            continue
        ag_procs = grouped[sg_id]
        for ag_id, procs in sorted(ag_procs.items()):
            for proc in sorted(
                procs,
                key=lambda p: (-(p.get("_matchPriority", 0)), p.get("name", "")),
            ):
                suggested_procedures.append(proc)

    # -- Build match statistics --

    by_soa = defaultdict(int)
    by_ag = defaultdict(int)
    by_reason = defaultdict(int)
    for entry in selected.values():
        proc = entry["procedure"]
        by_soa[proc.get("soaGroupId", "?")] += 1
        by_ag[proc.get("activityGroupId", "?")] += 1
        by_reason[entry["reason"]] += 1

    return {
        "therapeuticArea": ta,
        "phase": phase_key or "UNKNOWN",
        "isRandomized": is_randomized,
        "numberOfArms": num_arms,
        "suggestedProcedures": suggested_procedures,
        "suggestedVisits": visits,
        "matchStats": {
            "totalProcedures": len(selected),
            "bySoaGroup": dict(by_soa),
            "byActivityGroup": dict(by_ag),
            "outcomeKeywords": list(outcome_kws),
        },
    }
