from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..db import crud

router = APIRouter()

# Keys that belong to the schedule / SOA portion of study_design_data
SCHEDULE_KEYS = [
    "encounters",
    "activities",
    "scheduleTimelines",
    "soaGroups",
    "activityGroups",
]


@router.get("/{protocol_id}/schedule")
def get_schedule(protocol_id: str, db: Session = Depends(get_db)):
    """Return the schedule portion of study_design_data (encounters, activities, timelines)."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    sdd = protocol.study_design_data or {}
    schedule = {key: sdd.get(key, []) for key in SCHEDULE_KEYS}
    return schedule


@router.put("/{protocol_id}/schedule")
def update_schedule(
    protocol_id: str,
    body: dict,
    db: Session = Depends(get_db),
):
    """Save the full schedule data. Merges schedule keys into study_design_data."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    # Preserve existing data so we don't clobber design / objectives / etc.
    merged = dict(protocol.study_design_data or {})

    for key in SCHEDULE_KEYS:
        if key in body:
            merged[key] = body[key]

    updated = crud.update_study_design(db, protocol_id, merged)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update schedule")

    return {key: merged.get(key, []) for key in SCHEDULE_KEYS}
