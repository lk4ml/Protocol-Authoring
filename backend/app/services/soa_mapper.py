"""
SOA Mapper -- Maps ClinicalTrials.gov trial data to procedure library entries.

ALL classification is DATA-DRIVEN:
  - Therapeutic area detection uses indication profile condition signals (JSON files)
  - Procedure selection uses SDTM domain + activity group matching
  - Outcome/eligibility/PRO rules are loaded from per-indication profile files
  - Visit templates are configurable per TA and phase

Given a parsed CT.gov trial (NCT data), this module:
1. Infers the therapeutic area by matching conditions to profile signals
2. Determines the study phase, design, interventions
3. Loads the merged indication profile (default + TA-specific overrides)
4. Builds a recommended SOA by selecting procedures from the library
5. Returns grouped procedures with scheduling suggestions (visit mapping)

Adding a new indication:
  Create a JSON file in backend/app/terminology/indication_profiles/
  — see EXTENDING.md for the contract schema.
"""

import json
import os
from collections import defaultdict

from .indication_profiles import (
    get_profile,
    get_all_condition_signals,
)

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


# -- Therapeutic Area Detection (DATA-DRIVEN from profile JSON) -----

def detect_therapeutic_area(conditions, keywords, interventions, description="",
                            library=None):
    """
    Detect the primary therapeutic area by matching trial metadata
    against indication profile condition signals.

    Scoring:
    - Condition/keyword text (3x weight — most reliable signal)
    - Library TA procedure names (1x weight — supplementary)
    """
    text = " ".join([
        " ".join(conditions or []),
        " ".join(keywords or []),
        " ".join(interventions or []),
        description or "",
    ]).lower()

    if not text.strip():
        return "ALL"

    # Primary signals: condition signals from profile JSON files
    condition_text = " ".join([
        " ".join(conditions or []),
        " ".join(keywords or []),
    ]).lower()

    all_signals = get_all_condition_signals()
    scores = {}

    for ta_id, signal_list in all_signals.items():
        score = sum(3 for s in signal_list if s in condition_text)
        if score > 0:
            scores[ta_id] = score

    # Supplementary: procedure library TA names/categories (lower weight)
    if library:
        ta_procedures = library.get("taProcedures", {})
        ta_list = library.get("therapeuticAreas", [])
        ta_ids = {ta["id"] for ta in ta_list if ta["id"] != "ALL"}

        for ta_id in ta_ids:
            procs = ta_procedures.get(ta_id, [])
            if not procs:
                continue
            ta_terms = set()
            for p in procs:
                for cat in p.get("cdiscCategories", []):
                    ta_terms.add(cat.lower())
                words = p.get("name", "").lower().split()
                for w in words:
                    if len(w) >= 4:
                        ta_terms.add(w)
            lib_score = sum(1 for term in ta_terms if term in text)
            if lib_score > 0:
                scores[ta_id] = scores.get(ta_id, 0) + lib_score

            ta_name_lower = ta_id.lower().replace("_", " ")
            if ta_name_lower in text:
                scores[ta_id] = scores.get(ta_id, 0) + 5

    if not scores:
        return "ALL"

    return max(scores, key=scores.get)


# -- Data-driven procedure selection --------------------------------

ICH_M11_CORE_ACTIVITY_GROUPS = {
    "CONSENT", "ELIGIBILITY", "DEMOG", "DISPOSITION",
    "CLINICAL", "LABS", "AE", "IP_ADMIN",
}


def _select_core_procedures(all_procs, proc_by_ag, profile):
    """Select core procedures using indication profile rules."""
    selected = {}
    ich_row_names = profile.get("ichM11RowNames", {})
    exclude_patterns = profile.get("coreExcludePatterns", [])
    max_per_ag = profile.get("maxPerActivityGroup", {})

    for ag_id in ICH_M11_CORE_ACTIVITY_GROUPS:
        candidates = proc_by_ag.get(ag_id, [])
        if not candidates:
            continue

        core_candidates = [p for p in candidates if p.get("therapeuticArea") == "ALL"]
        if not core_candidates:
            core_candidates = candidates

        limit = max_per_ag.get(ag_id, 3)
        row_names = ich_row_names.get(ag_id, [])

        def sort_key(p):
            src = (p.get("source") or "").lower()
            name = (p.get("name") or "").lower()
            is_essential = any(s in src for s in ["ich", "cdash", "fda", "sdtm ig"])
            matches_row = any(rn in name for rn in row_names)
            cats = p.get("cdiscCategories", [])
            is_parent_level = len(cats) > 0 and not any(
                "question" in c.lower() for c in cats
            )
            tier = 3
            if is_essential:
                tier = 0
            elif matches_row:
                tier = 1
            elif is_parent_level:
                tier = 2
            return (tier, name)

        sorted_candidates = sorted(core_candidates, key=sort_key)

        filtered = []
        for p in sorted_candidates:
            pname_lower = (p.get("name") or "").lower()
            if len(pname_lower) < 8:
                continue
            if any(excl in pname_lower for excl in exclude_patterns):
                continue
            filtered.append(p)

        tier1, tier2 = [], []
        for p in filtered:
            tier_val, _ = sort_key(p)
            (tier1 if tier_val <= 1 else tier2).append(p)

        added = 0
        for p in tier1 + tier2:
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
    """Add phase-appropriate procedures (PK, cardiac, etc.)."""
    if not phase_key:
        return

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

    if phase_key in ("PHASE1", "PHASE2", "PHASE3"):
        candidates = proc_by_ag.get("CARDIAC", [])
        core_candidates = [p for p in candidates if p.get("therapeuticArea") == "ALL"]
        if not core_candidates:
            core_candidates = candidates

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
    """Add TA-specific procedures from the library's taProcedures section."""
    ta_procs = ta_procedures.get(ta, [])
    if not ta_procs:
        return

    ta_by_ag = defaultdict(list)
    for p in ta_procs:
        ag = p.get("activityGroupId", "")
        ta_by_ag[ag].append(p)

    for ag_id, procs in ta_by_ag.items():
        limit = 2 if ag_id in ("QOL", "SYMPTOM") else 3

        def ta_sort_key(p):
            name = p.get("name", "")
            src = (p.get("source") or "").lower()
            is_qrs = "qrs" in src or "nci evs" in src
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


def _extract_outcomes_keywords(outcomes, profile):
    """Extract assessment-related keywords using profile outcome signals."""
    keywords = set()
    all_outcomes = []
    if outcomes:
        all_outcomes.extend(outcomes.get("primary", []) or [])
        all_outcomes.extend(outcomes.get("secondary", []) or [])

    outcome_signals = profile.get("outcomeSignals", {})

    for out in all_outcomes:
        measure = (out.get("measure") or "").lower()
        desc = (out.get("description") or "").lower()
        text = measure + " " + desc

        for key, patterns in outcome_signals.items():
            if any(w in text for w in patterns):
                keywords.add(key)

    return keywords


def _select_outcome_procedures(outcome_kws, all_procs, proc_by_name, selected, profile):
    """Add procedures driven by trial outcome measures using profile rules."""
    outcome_to_search = profile.get("outcomeToSearch", {})

    for kw in outcome_kws:
        search_terms = outcome_to_search.get(kw, [])
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
                        "reason": f"Trial outcome measure requires {term}",
                        "priority": 2,
                    }


def _select_eligibility_procedures(elig_text, proc_by_name, all_procs, selected, profile):
    """Add procedures driven by eligibility criteria using profile rules."""
    elig_lower = elig_text.lower()
    elig_signals = profile.get("eligibilitySignals", {})

    for pattern, search_terms in elig_signals.items():
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


def _select_pro_instruments(outcomes, proc_by_name, selected, profile):
    """Match PRO instruments using profile's known abbreviations."""
    all_outcomes_text = []
    for outcome_type in ["primary", "secondary", "other"]:
        for out in (outcomes.get(outcome_type) or []):
            text = (out.get("measure") or "") + " " + (out.get("description") or "")
            all_outcomes_text.append(text.lower())
    combined = " ".join(all_outcomes_text)

    if not combined.strip():
        return

    known_pro = profile.get("knownProAbbreviations", [])

    for abbrev in known_pro:
        if abbrev in combined:
            for pname, proc in proc_by_name.items():
                if abbrev in pname:
                    pid = proc.get("id", "")
                    if pid and pid not in selected:
                        selected[pid] = {
                            "procedure": proc,
                            "reason": f"PRO instrument '{abbrev.upper()}' in trial outcomes",
                            "priority": 2,
                        }
                    break


def build_suggested_soa(trial_data):
    """
    Build a suggested Schedule of Activities from CT.gov trial data.

    ALL rules are loaded from indication profile JSON files.
    """
    lib = _load_procedure_library()
    hierarchy = _load_soa_hierarchy()

    all_procs = list(lib.get("coreProcedures", []))
    ta_procedures = lib.get("taProcedures", {})
    for ta_procs in ta_procedures.values():
        all_procs.extend(ta_procs)

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

    # Detect TA (profile-driven)
    ta = detect_therapeutic_area(
        conditions, keywords, interventions, description, library=lib
    )

    # Load merged indication profile
    profile = get_profile(ta)

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

    outcomes = trial_data.get("outcomes") or {}
    outcome_kws = _extract_outcomes_keywords(outcomes, profile)

    # -- Build procedure selection (ALL profile-driven) --
    selected = _select_core_procedures(all_procs, proc_by_ag, profile)
    _select_phase_procedures(phase_key, all_procs, proc_by_ag, selected)
    _select_ta_procedures(ta, all_procs, proc_by_ag, ta_procedures, selected)
    _select_outcome_procedures(outcome_kws, all_procs, proc_by_name, selected, profile)

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
    _select_eligibility_procedures(elig_text, proc_by_name, all_procs, selected, profile)
    _select_pro_instruments(outcomes, proc_by_name, selected, profile)

    # -- Build visits from profile templates --
    arms = trial_data.get("arms") or []
    num_arms = trial_data.get("numberOfArms") or len(arms) or 2
    design_info = (trial_data.get("designInfo")
                   or trial_data.get("design_info") or {})
    if isinstance(design_info, str):
        design_info = {}

    is_randomized = "random" in (design_info.get("allocation") or "").lower()

    visit_templates = profile.get("visitTemplates", {})
    treatment_weeks = visit_templates.get(
        phase_key or "DEFAULT",
        visit_templates.get("DEFAULT", [4, 8, 12, 24, 36, 48])
    )

    visits = []
    visits.append({
        "name": "Screening", "week": -4,
        "epoch": "Screening", "studyDay": -28,
    })
    visits.append({
        "name": "Baseline/Randomization" if is_randomized else "Baseline",
        "week": 0, "epoch": "Screening", "studyDay": 1,
    })
    for wk in treatment_weeks:
        visits.append({
            "name": f"Week {wk}", "week": wk,
            "epoch": "Treatment", "studyDay": wk * 7 + 1,
        })
    visits.append({"name": "End of Treatment", "week": None, "epoch": "Treatment", "studyDay": None})
    visits.append({"name": "Follow-up 1", "week": None, "epoch": "Follow-up", "studyDay": None})
    visits.append({"name": "Follow-up 2", "week": None, "epoch": "Follow-up", "studyDay": None})

    # -- Group by SOA hierarchy --
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
        for ag_id, procs in sorted(grouped[sg_id].items()):
            for proc in sorted(
                procs,
                key=lambda p: (-(p.get("_matchPriority", 0)), p.get("name", "")),
            ):
                suggested_procedures.append(proc)

    by_soa = defaultdict(int)
    by_ag = defaultdict(int)
    for entry in selected.values():
        proc = entry["procedure"]
        by_soa[proc.get("soaGroupId", "?")] += 1
        by_ag[proc.get("activityGroupId", "?")] += 1

    return {
        "therapeuticArea": ta,
        "indicationProfile": ta if ta != "ALL" else "default",
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
