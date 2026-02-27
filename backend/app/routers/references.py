"""
Reference Trials Router
-----------------------
CRUD for reference trials attached to a protocol.
Reference trials are parsed ClinicalTrials.gov data stored in the
``reference_trials`` JSON column on the protocols table.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..database import get_db
from ..db import crud
from ..models.requests import ReferenceTrialRequest

router = APIRouter()


@router.get("/{protocol_id}/references")
def get_references(protocol_id: str, db: Session = Depends(get_db)):
    """Return all reference trials for a protocol."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return protocol.reference_trials or []


@router.post("/{protocol_id}/references")
def add_reference(
    protocol_id: str,
    body: ReferenceTrialRequest,
    db: Session = Depends(get_db),
):
    """Add a parsed reference trial. Rejects duplicates by nctId."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    refs = list(protocol.reference_trials or [])
    nct_id = body.nctId

    # Prevent duplicates
    if any(r.get("nctId") == nct_id for r in refs):
        raise HTTPException(status_code=409, detail="Trial already added as reference")

    refs.append(body.model_dump())
    protocol.reference_trials = refs
    protocol.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(protocol)
    return protocol.reference_trials


@router.delete("/{protocol_id}/references/{nct_id}")
def remove_reference(protocol_id: str, nct_id: str, db: Session = Depends(get_db)):
    """Remove a reference trial by NCT ID."""
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    before_count = len(protocol.reference_trials or [])
    refs = [r for r in (protocol.reference_trials or []) if r.get("nctId") != nct_id]

    if len(refs) == before_count:
        raise HTTPException(status_code=404, detail="Reference trial not found")

    protocol.reference_trials = refs
    protocol.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(protocol)
    return {"removed": nct_id, "remaining": len(refs)}
