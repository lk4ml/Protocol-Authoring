import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..db import crud
from ..models.requests import ScheduleUpdateRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# Keys that belong to the schedule / SOA portion of study_design_data
SCHEDULE_KEYS = [
    "encounters",
    "activities",
    "scheduleTimelines",
    "soaGroups",
    "activityGroups",
]


async def _try_graph_read(protocol_id: str) -> dict | None:
    """Attempt to read schedule from Neo4j. Returns None if unavailable."""
    try:
        from ..graph import get_session
        from ..graph import crud as graph_crud
        async with get_session() as session:
            return await graph_crud.get_schedule(session, protocol_id)
    except Exception as e:
        logger.debug(f"Graph read failed, falling back to SQLite: {e}")
        return None


@router.get("/{protocol_id}/schedule")
async def get_schedule(protocol_id: str, db: Session = Depends(get_db)):
    """Return the schedule portion of study_design_data (encounters, activities, timelines)."""
    # Try Neo4j first
    graph_result = await _try_graph_read(protocol_id)
    if graph_result is not None:
        return graph_result

    # Fallback to SQLite
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    sdd = protocol.study_design_data or {}
    schedule = {key: sdd.get(key, []) for key in SCHEDULE_KEYS}
    return schedule


@router.put("/{protocol_id}/schedule")
def update_schedule(
    protocol_id: str,
    body: ScheduleUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Save the full schedule data.

    Validates and normalizes incoming data through ScheduleUpdateRequest:
    - Converts legacy activityId (singular) -> activityIds (list)
    - Converts legacy conditionality -> defaultConditionId
    - Validates all required fields via Pydantic
    """
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    merged = dict(protocol.study_design_data or {})

    # model_dump ensures canonical field names (no legacy fields)
    payload = body.model_dump(exclude_none=True)
    for key in SCHEDULE_KEYS:
        if key in payload:
            merged[key] = payload[key]

    updated = crud.update_study_design(db, protocol_id, merged)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update schedule")

    return {key: merged.get(key, []) for key in SCHEDULE_KEYS}
