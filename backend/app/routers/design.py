from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..db import crud

router = APIRouter()

# Keys that belong to the study design portion of study_design_data
DESIGN_KEYS = [
    "studyArms",
    "studyEpochs",
    "studyCells",
    "studyElements",
    "studyMarkers",
    "studyFlowOverrides",
    "interventionModel",
    "blindingSchema",
    "eligibilityCriteria",
    "objectives",
]


def _normalize_eligibility(raw):
    """Normalize eligibilityCriteria to {inclusion: [], exclusion: []} dict format."""
    if isinstance(raw, list):
        return {
            "inclusion": [c for c in raw if c.get("category") == "inclusion"],
            "exclusion": [c for c in raw if c.get("category") == "exclusion"],
        }
    if isinstance(raw, dict) and ("inclusion" in raw or "exclusion" in raw):
        return raw
    return {"inclusion": [], "exclusion": []}


@router.get("/{protocol_id}/design")
def get_study_design(protocol_id: str, db: Session = Depends(get_db)):
    """Return the study design portion of study_design_data."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    sdd = protocol.study_design_data or {}
    scalar_keys = ("interventionModel", "blindingSchema")
    design = {}
    for key in DESIGN_KEYS:
        if key in scalar_keys:
            design[key] = sdd.get(key, None)
        elif key == "eligibilityCriteria":
            design[key] = _normalize_eligibility(sdd.get(key))
        else:
            design[key] = sdd.get(key, [])
    return design


@router.put("/{protocol_id}/design")
def update_study_design(
    protocol_id: str,
    body: dict,
    db: Session = Depends(get_db),
):
    """Save the full study design. Merges design keys into study_design_data."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    # Start from existing data so we don't clobber schedule / objectives / etc.
    merged = dict(protocol.study_design_data or {})

    for key in DESIGN_KEYS:
        if key in body:
            merged[key] = body[key]

    updated = crud.update_study_design(db, protocol_id, merged)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update study design")

    # Return the design portion back to the caller
    result = {}
    scalar_keys = ("interventionModel", "blindingSchema")
    for key in DESIGN_KEYS:
        if key in scalar_keys:
            result[key] = merged.get(key, None)
        elif key == "eligibilityCriteria":
            result[key] = _normalize_eligibility(merged.get(key))
        else:
            result[key] = merged.get(key, [])
    return result
