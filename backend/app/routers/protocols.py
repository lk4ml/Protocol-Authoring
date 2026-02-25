from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..db import crud
from ..services import template_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class ProtocolCreateRequest(BaseModel):
    template: str = "blank"  # "blank" or "oncology_phase3"
    protocolNumber: str
    fullTitle: Optional[str] = ""
    shortTitle: Optional[str] = ""
    phase: Optional[str] = ""
    studyType: Optional[str] = "Interventional"
    therapeuticArea: Optional[str] = ""
    indication: Optional[str] = ""
    sponsorName: Optional[str] = ""
    sampleSize: Optional[int] = None


class ProtocolUpdateRequest(BaseModel):
    protocolNumber: Optional[str] = None
    fullTitle: Optional[str] = None
    shortTitle: Optional[str] = None
    phase: Optional[str] = None
    studyType: Optional[str] = None
    therapeuticArea: Optional[str] = None
    indication: Optional[str] = None
    sponsorName: Optional[str] = None
    sampleSize: Optional[int] = None
    status: Optional[str] = None


class ProtocolSummary(BaseModel):
    id: str
    protocolNumber: str
    shortTitle: str
    phase: str
    therapeuticArea: str
    status: str
    updatedAt: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_summary(row) -> dict:
    return {
        "id": row.id,
        "protocolNumber": row.protocol_number,
        "shortTitle": row.short_title or "",
        "phase": row.phase or "",
        "therapeuticArea": row.therapeutic_area or "",
        "status": row.status or "Draft",
        "updatedAt": row.updated_at.isoformat() if row.updated_at else "",
    }


def _row_to_full(row) -> dict:
    return {
        "id": row.id,
        "protocolNumber": row.protocol_number,
        "fullTitle": row.full_title or "",
        "shortTitle": row.short_title or "",
        "phase": row.phase or "",
        "studyType": row.study_type or "",
        "therapeuticArea": row.therapeutic_area or "",
        "indication": row.indication or "",
        "sponsorName": row.sponsor_name or "",
        "sampleSize": row.sample_size,
        "status": row.status or "Draft",
        "version": row.version or "1.0",
        "templateId": row.template_id,
        "studyDesignData": row.study_design_data or {},
        "narrativeSections": row.narrative_sections or {},
        "referenceTrials": row.reference_trials or [],
        "createdAt": row.created_at.isoformat() if row.created_at else "",
        "updatedAt": row.updated_at.isoformat() if row.updated_at else "",
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("")
def create_protocol(body: ProtocolCreateRequest, db: Session = Depends(get_db)):
    """Create a new protocol, optionally from a template."""
    overrides = {
        "protocolNumber": body.protocolNumber,
        "fullTitle": body.fullTitle,
        "shortTitle": body.shortTitle,
        "phase": body.phase,
        "studyType": body.studyType,
        "therapeuticArea": body.therapeuticArea,
        "indication": body.indication,
        "sponsorName": body.sponsorName,
        "sampleSize": body.sampleSize,
    }
    template_data = template_service.create_protocol_from_template(body.template, overrides)

    data = {
        "id": template_data["id"],
        "protocolNumber": template_data["protocol_number"],
        "fullTitle": template_data["full_title"],
        "shortTitle": template_data["short_title"],
        "phase": template_data["phase"],
        "studyType": template_data["study_type"],
        "therapeuticArea": template_data["therapeutic_area"],
        "indication": template_data["indication"],
        "sponsorName": template_data["sponsor_name"],
        "sampleSize": template_data["sample_size"],
        "templateId": body.template,
        "studyDesignData": template_data["study_design_data"],
        "narrativeSections": template_data["narrative_sections"],
    }

    row = crud.create_protocol(db, data)
    return _row_to_full(row)


@router.get("")
def list_protocols(db: Session = Depends(get_db)):
    """List all protocols with summary info."""
    rows = crud.list_protocols(db)
    return [_row_to_summary(r) for r in rows]


@router.get("/{protocol_id}")
def get_protocol(protocol_id: str, db: Session = Depends(get_db)):
    """Get full protocol including study_design_data and narrative_sections."""
    row = crud.get_protocol(db, protocol_id)
    if not row:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return _row_to_full(row)


@router.put("/{protocol_id}")
def update_protocol(
    protocol_id: str,
    body: ProtocolUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update protocol metadata (not design data). Accepts any subset of fields."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    row = crud.update_protocol(db, protocol_id, update_data)
    if not row:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return _row_to_full(row)


@router.delete("/{protocol_id}")
def delete_protocol(protocol_id: str, db: Session = Depends(get_db)):
    """Delete a protocol."""
    deleted = crud.delete_protocol(db, protocol_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return {"deleted": True, "id": protocol_id}
