"""
Indication Profile Loader
--------------------------
Loads per-indication data profiles from JSON files, merges TA-specific
overrides on top of the _default.json base profile.

This replaces all hardcoded CONDITION_SIGNALS, OUTCOME_TO_DOMAIN,
ELIG_TO_SEARCH, KNOWN_PRO_ABBREVIATIONS, etc. that were previously
embedded in soa_mapper.py.

Adding a new indication:
  1. Create a new JSON file in indication_profiles/ (e.g., respiratory.json)
  2. Include "conditionSignals" for TA detection and any "additional*" sections
  3. The profile is auto-discovered — no code changes needed.
"""

import json
import os
from functools import lru_cache
from typing import Optional

PROFILES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "terminology",
    "indication_profiles",
)


def _load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_all_profiles() -> dict:
    """
    Load and cache all profile JSON files from disk.

    Returns dict keyed by profile TA id (uppercase), e.g.:
      { "ALL": {...}, "ONCOLOGY": {...}, "CARDIOVASCULAR": {...} }
    """
    profiles = {}
    if not os.path.isdir(PROFILES_DIR):
        return profiles

    for fname in os.listdir(PROFILES_DIR):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(PROFILES_DIR, fname)
        data = _load_json(path)
        meta = data.get("_meta", {})
        ta_id = meta.get("id", fname.replace(".json", "").upper())
        profiles[ta_id] = data

    return profiles


def get_default_profile() -> dict:
    """Return the base _default.json profile."""
    profiles = _load_all_profiles()
    return profiles.get("ALL", {})


def get_profile(ta_id: str) -> dict:
    """
    Return a merged profile for the given therapeutic area.

    Merges the TA-specific profile on top of the default:
    - Lists are concatenated (e.g., additionalProAbbreviations + base knownProAbbreviations)
    - Dicts are shallow-merged (TA keys override/extend base keys)
    - Scalars from TA profile take precedence
    """
    profiles = _load_all_profiles()
    default = dict(profiles.get("ALL", {}))
    ta_profile = profiles.get(ta_id.upper(), {})

    if not ta_profile:
        return default

    merged = dict(default)

    # Merge condition signals (TA profile has its own, not inherited)
    # The condition signals for TA profiles are stored as a list
    # (unlike default which has an empty placeholder)

    # Merge exclude patterns
    base_excludes = list(merged.get("coreExcludePatterns", []))
    ta_extra = ta_profile.get("additionalExcludePatterns", [])
    merged["coreExcludePatterns"] = base_excludes + ta_extra

    # Merge outcome signals (dict of lists — extend each key)
    base_outcome = dict(merged.get("outcomeSignals", {}))
    for key, patterns in ta_profile.get("additionalOutcomeSignals", {}).items():
        existing = base_outcome.get(key, [])
        # Deduplicate while preserving order
        combined = list(existing)
        for p in patterns:
            if p not in combined:
                combined.append(p)
        base_outcome[key] = combined
    merged["outcomeSignals"] = base_outcome

    # Merge outcome-to-search (dict of lists — extend)
    base_ots = dict(merged.get("outcomeToSearch", {}))
    for key, terms in ta_profile.get("additionalOutcomeToSearch", {}).items():
        existing = base_ots.get(key, [])
        combined = list(existing)
        for t in terms:
            if t not in combined:
                combined.append(t)
        base_ots[key] = combined
    merged["outcomeToSearch"] = base_ots

    # Merge eligibility signals (dict of lists — extend)
    base_elig = dict(merged.get("eligibilitySignals", {}))
    for key, terms in ta_profile.get("additionalEligibilitySignals", {}).items():
        existing = base_elig.get(key, [])
        combined = list(existing)
        for t in terms:
            if t not in combined:
                combined.append(t)
        base_elig[key] = combined
    merged["eligibilitySignals"] = base_elig

    # Merge PRO abbreviations (list — concatenate + deduplicate)
    base_pro = list(merged.get("knownProAbbreviations", []))
    ta_pro = ta_profile.get("additionalProAbbreviations", [])
    combined_pro = list(base_pro)
    for p in ta_pro:
        if p not in combined_pro:
            combined_pro.append(p)
    merged["knownProAbbreviations"] = combined_pro

    # Visit templates: TA overrides take precedence per phase
    base_visits = dict(merged.get("visitTemplates", {}))
    ta_visits = ta_profile.get("visitTemplates", {})
    base_visits.update(ta_visits)
    merged["visitTemplates"] = base_visits

    return merged


def get_all_condition_signals() -> dict:
    """
    Return all condition signals from all TA profiles, keyed by TA id.

    Used by detect_therapeutic_area() to score conditions against all
    known TAs without hardcoding any signals in Python.
    """
    profiles = _load_all_profiles()
    signals = {}
    for ta_id, profile in profiles.items():
        if ta_id == "ALL":
            continue
        cs = profile.get("conditionSignals", [])
        if isinstance(cs, list) and cs:
            signals[ta_id] = cs
    return signals


def list_available_profiles() -> list:
    """Return metadata for all loaded profiles (for API/documentation)."""
    profiles = _load_all_profiles()
    return [
        {
            "id": ta_id,
            "name": profile.get("_meta", {}).get("name", ta_id),
            "description": profile.get("_meta", {}).get("description", ""),
        }
        for ta_id, profile in sorted(profiles.items())
    ]
