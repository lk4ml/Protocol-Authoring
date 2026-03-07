"""
USDM v3.0 assembler service.

Takes a ProtocolProxy (or ProtocolDB) object and produces a Python dictionary
that conforms to the CDISC Unified Study Definitions Model (USDM) v3.0
``Study`` structure.

The resulting hierarchy is:

    Study
      -> versions: [StudyVersion]
           -> studyIdentifiers
           -> studyTitles
           -> studyPhase
           -> studyType
           -> studyDesigns: [StudyDesign]
                -> (all study_design_data fields)
"""

from __future__ import annotations

import uuid
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Protocol as ProtocolType


def _new_id() -> str:
    return str(uuid.uuid4())


def _normalize_coded_field(value: Any) -> dict:
    """Normalize a coded design field that may be a plain string or a dict.

    Some protocols store interventionModel/blindingSchema as:
    - Plain string: ``"Factorial"``, ``"Double Blind"``
    - Dict:         ``{"code": "C12345", "decode": "Factorial", ...}``

    Returns a dict with at least ``decode``; ``code`` may be empty.
    """
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return {"code": "", "decode": value}
    return {"code": "", "decode": str(value) if value else ""}


def _make_code(code: str, decode: str, code_system: str = "http://www.cdisc.org",
               code_system_version: str = "2024-03-29") -> dict[str, str]:
    """Create a USDM Code dict."""
    return {
        "id": _new_id(),
        "code": code,
        "codeSystem": code_system,
        "codeSystemVersion": code_system_version,
        "decode": decode,
    }


# ---------------------------------------------------------------------------
# Phase label -> CDISC code lookup
# ---------------------------------------------------------------------------

_PHASE_CODES: dict[str, tuple[str, str]] = {
    "Phase 0":     ("C49686", "Phase 0 Trial"),
    "Phase I":     ("C15600", "Phase I Trial"),
    "Phase I/II":  ("C15693", "Phase I/II Trial"),
    "Phase II":    ("C15601", "Phase II Trial"),
    "Phase II/III":("C15694", "Phase II/III Trial"),
    "Phase III":   ("C15602", "Phase III Trial"),
    "Phase IIIb":  ("C49688", "Phase IIIb Trial"),
    "Phase IV":    ("C15603", "Phase IV Trial"),
}

_STUDY_TYPE_CODES: dict[str, tuple[str, str]] = {
    "Interventional Study": ("C98388", "Interventional Study"),
    "Interventional":       ("C98388", "Interventional Study"),
    "Observational Study":  ("C142615", "Observational Study"),
    "Observational":        ("C142615", "Observational Study"),
    "Expanded Access":      ("C176264", "Expanded Access Study"),
}


def _phase_code(phase_label: str) -> dict | None:
    """Resolve a human-readable phase label to a USDM Code dict."""
    match = _PHASE_CODES.get(phase_label)
    if match:
        return _make_code(match[0], match[1])
    return None


def _study_type_code(study_type_label: str) -> dict | None:
    """Resolve a study type label to a USDM Code dict."""
    match = _STUDY_TYPE_CODES.get(study_type_label)
    if match:
        return _make_code(match[0], match[1])
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def assemble_usdm(protocol_db: "ProtocolDB") -> dict[str, Any]:
    """Assemble a USDM v3.0 Study dictionary from a ProtocolDB row.

    Parameters
    ----------
    protocol_db:
        A SQLAlchemy ``ProtocolDB`` instance loaded from the database.

    Returns
    -------
    dict
        A dictionary conforming to the USDM v3.0 Study structure, ready
        for JSON serialisation.
    """
    study_design_data: dict = protocol_db.study_design_data or {}
    narrative_sections: dict = protocol_db.narrative_sections or {}

    # -- Study identifiers ---------------------------------------------------
    sponsor_org = {
        "id": _new_id(),
        "name": protocol_db.sponsor_name or "",
        "organizationType": _make_code("C70793", "Clinical Study Sponsor"),
    }

    study_identifier = {
        "id": _new_id(),
        "studyIdentifier": protocol_db.protocol_number or "",
        "studyIdentifierScope": sponsor_org,
    }

    # -- Study titles --------------------------------------------------------
    study_titles: list[dict] = []

    if protocol_db.full_title:
        study_titles.append({
            "id": _new_id(),
            "text": protocol_db.full_title,
            "type": _make_code("C99905", "Official Study Title"),
        })

    if protocol_db.short_title:
        study_titles.append({
            "id": _new_id(),
            "text": protocol_db.short_title,
            "type": _make_code("C99906", "Brief Study Title"),
        })

    # -- Study design --------------------------------------------------------
    study_design: dict[str, Any] = {
        "id": _new_id(),
        "name": "Main Design",
    }

    # Copy core design collections from the stored JSON blob.
    _design_keys = [
        "studyArms", "studyEpochs", "studyCells", "studyElements",
        "encounters", "activities", "scheduleTimelines",
        "objectives", "estimands", "eligibilityCriteria",
        "indications", "studyInterventions", "biomedicalConcepts",
    ]
    for key in _design_keys:
        if key in study_design_data:
            val = study_design_data[key]
            # Normalize eligibilityCriteria: if stored as dict {inclusion, exclusion},
            # convert to flat USDM list with category field.
            if key == "eligibilityCriteria" and isinstance(val, dict):
                flat: list[dict] = []
                for idx, item in enumerate(val.get("inclusion", [])):
                    flat.append({**item, "category": "inclusion", "order": idx})
                for idx, item in enumerate(val.get("exclusion", [])):
                    flat.append({**item, "category": "exclusion", "order": idx})
                val = flat
            study_design[key] = val

    # Coded design-level attributes (may be plain string or dict)
    if study_design_data.get("interventionModel"):
        im = _normalize_coded_field(study_design_data["interventionModel"])
        study_design["interventionModel"] = {
            "id": _new_id(),
            "code": im.get("code", ""),
            "codeSystem": im.get("codeSystem", "http://www.cdisc.org"),
            "codeSystemVersion": im.get("codeSystemVersion", "2024-03-29"),
            "decode": im.get("decode", ""),
        }

    if study_design_data.get("blindingSchema"):
        bs = _normalize_coded_field(study_design_data["blindingSchema"])
        study_design["blindingSchema"] = {
            "id": _new_id(),
            "code": bs.get("code", ""),
            "codeSystem": bs.get("codeSystem", "http://www.cdisc.org"),
            "codeSystemVersion": bs.get("codeSystemVersion", "2024-03-29"),
            "decode": bs.get("decode", ""),
        }

    if protocol_db.sample_size is not None:
        study_design["sampleSize"] = protocol_db.sample_size

    study_type_coded = _study_type_code(protocol_db.study_type or "")
    if study_type_coded:
        study_design["studyType"] = study_type_coded

    # -- Study version -------------------------------------------------------
    study_version: dict[str, Any] = {
        "id": _new_id(),
        "versionIdentifier": protocol_db.version or "1.0",
        "rationale": None,
        "studyIdentifiers": [study_identifier],
        "studyTitles": study_titles,
        "studyDesigns": [study_design],
    }

    phase_coded = _phase_code(protocol_db.phase or "")
    if phase_coded:
        study_version["studyPhase"] = phase_coded

    if study_type_coded:
        study_version["studyType"] = study_type_coded

    # -- Narrative content ---------------------------------------------------
    # Attach narrative sections as a USDM-compatible extension so that
    # downstream consumers can generate the ICH M11 document.
    if narrative_sections:
        study_version["narrativeContentModule"] = {
            "id": _new_id(),
            "sections": narrative_sections,
        }

    # -- Top-level Study -----------------------------------------------------
    study: dict[str, Any] = {
        "id": _new_id(),
        "name": protocol_db.protocol_number or protocol_db.short_title or "",
        "description": protocol_db.full_title or "",
        "versions": [study_version],
    }

    return {"study": study}
