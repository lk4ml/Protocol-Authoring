import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..db import crud
from ..models.requests import StudyDesignUpdateRequest

router = APIRouter()
logger = logging.getLogger(__name__)

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


async def _try_graph_read(protocol_id: str) -> dict | None:
    """Attempt to read design from Neo4j. Returns None if unavailable."""
    try:
        from ..graph import get_session
        from ..graph import crud as graph_crud
        async with get_session() as session:
            return await graph_crud.get_design(session, protocol_id)
    except Exception as e:
        logger.debug(f"Graph read failed, falling back to SQLite: {e}")
        return None


def _design_from_sqlite(protocol) -> dict:
    """Extract design dict from SQLite protocol row."""
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


@router.get("/{protocol_id}/design")
async def get_study_design(protocol_id: str, db: Session = Depends(get_db)):
    """Return the study design portion of study_design_data."""
    # Try Neo4j first
    graph_result = await _try_graph_read(protocol_id)
    if graph_result is not None:
        return graph_result

    # Fallback to SQLite
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return _design_from_sqlite(protocol)


@router.put("/{protocol_id}/design")
def update_study_design(
    protocol_id: str,
    body: StudyDesignUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Save the full study design.

    Validates incoming data via StudyDesignUpdateRequest (Pydantic).
    Merges only provided keys into study_design_data.
    """
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    # Start from existing data so we don't clobber schedule / objectives / etc.
    merged = dict(protocol.study_design_data or {})

    payload = body.model_dump(exclude_none=True)
    for key in DESIGN_KEYS:
        if key in payload:
            merged[key] = payload[key]

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
