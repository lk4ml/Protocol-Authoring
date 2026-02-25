"""
CDISC terminology service.

Serves bundled CDISC controlled terminology from JSON files located in the
``../terminology/`` directory relative to this module.  Each JSON file
contains an array of coded values (code, decode, and optional label) for a
specific terminology domain.

Data is cached in a module-level dictionary so that each file is read from
disk at most once per process lifetime.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

TERMINOLOGY_DIR = Path(__file__).resolve().parent.parent / "terminology"

# Module-level cache: filename stem -> parsed JSON content
_cache: dict[str, Any] = {}


def _load(filename: str) -> Any:
    """Load a terminology JSON file and cache the result.

    Parameters
    ----------
    filename:
        Name of the JSON file (without directory) to load, e.g.
        ``"phases.json"``.

    Returns
    -------
    The parsed JSON content (typically a list of dicts).

    Raises
    ------
    FileNotFoundError
        If the specified terminology file does not exist.
    """
    if filename in _cache:
        return _cache[filename]

    path = TERMINOLOGY_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f"Terminology file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    _cache[filename] = data
    return data


# ---------------------------------------------------------------------------
# Public accessors -- one per terminology domain
# ---------------------------------------------------------------------------

def get_phases() -> list[dict]:
    """Clinical trial phases (e.g. Phase I, Phase II, Phase III)."""
    return _load("phases.json")


def get_study_types() -> list[dict]:
    """Study types (Interventional, Observational, etc.)."""
    return _load("study_types.json")


def get_epoch_types() -> list[dict]:
    """Study epoch types (Screening, Treatment, Follow-up, etc.)."""
    return _load("epoch_types.json")


def get_arm_types() -> list[dict]:
    """Study arm types (Experimental, Placebo Comparator, etc.)."""
    return _load("arm_types.json")


def get_intervention_models() -> list[dict]:
    """Intervention models (Parallel, Crossover, etc.)."""
    return _load("intervention_models.json")


def get_blinding_schemas() -> list[dict]:
    """Blinding schemas (Open Label, Single Blind, Double Blind, etc.)."""
    return _load("blinding_schemas.json")


def get_sdtm_domains() -> list[dict]:
    """Standard SDTM domains (DM, AE, LB, VS, etc.)."""
    return _load("sdtm_domains.json")


def get_oncology_domains() -> list[dict]:
    """Oncology-specific SDTM domains (TU, TR, RS, etc.)."""
    return _load("oncology_domains.json")


def get_response_criteria() -> list[dict]:
    """Response evaluation criteria (RECIST 1.1, iRECIST, etc.)."""
    return _load("response_criteria.json")


def get_activity_catalog() -> dict:
    """CDISC-sourced activity catalog for Schedule of Activities.

    Generated from COSMoS Biomedical Concepts and SDTM Dataset
    Specializations.  Returns a dict with ``activities`` (list) and
    ``schedulingPatterns`` (list).
    """
    return _load("activity_catalog.json")


def get_procedure_library() -> dict:
    """Curated procedure library organized by therapeutic area.

    Contains core procedures (common to all trials) and TA-specific
    procedures organized by therapeutic area (Oncology, Diabetes, etc.).
    Returns a dict with ``therapeuticAreas``, ``coreProcedures``, and
    ``taProcedures``.
    """
    return _load("procedure_library.json")


def get_procedure_burden() -> dict:
    """Procedure burden metrics (time, cost, blood volume, RVU).

    Contains per-procedure burden metrics derived from CMS RVU/CLFS data,
    LOINC codes, published specimen collection guides, and time-motion
    studies.  Keyed by procedure ID matching the procedure library.
    """
    return _load("procedure_burden.json")


def get_soa_hierarchy() -> dict:
    """SOA hierarchy definitions for protocol flowchart.

    Contains SOA Groups (top-level flowchart sections like SAFETY, EFFICACY)
    and Activity Groups (sub-sections like Laboratory Assessments, Vital Signs)
    with auto-assignment rules mapping uiCategory + sdtmDomain to hierarchy.
    """
    return _load("soa_hierarchy.json")
