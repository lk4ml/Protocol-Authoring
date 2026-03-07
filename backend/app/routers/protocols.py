"""
Protocol CRUD router — Neo4j graph-only.

All protocol metadata and study design data lives in the Neo4j graph.
"""

import json
import logging
import traceback
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..graph import get_session
from ..graph import crud as graph_crud
from ..services import template_service

router = APIRouter()
logger = logging.getLogger(__name__)


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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _graph_to_summary(p: dict) -> dict:
    return {
        "id": p.get("id", ""),
        "protocolNumber": p.get("protocolNumber", ""),
        "shortTitle": p.get("shortTitle", ""),
        "phase": p.get("phase", ""),
        "therapeuticArea": p.get("therapeuticArea", ""),
        "status": p.get("status", "Draft"),
        "updatedAt": p.get("updatedAt", ""),
    }


def _graph_to_full(p: dict) -> dict:
    narrative = p.get("narrativeSections", "{}")
    if isinstance(narrative, str):
        try:
            narrative = json.loads(narrative)
        except (json.JSONDecodeError, TypeError):
            narrative = {}

    return {
        "id": p.get("id", ""),
        "protocolNumber": p.get("protocolNumber", ""),
        "fullTitle": p.get("fullTitle", ""),
        "shortTitle": p.get("shortTitle", ""),
        "phase": p.get("phase", ""),
        "studyType": p.get("studyType", ""),
        "therapeuticArea": p.get("therapeuticArea", ""),
        "indication": p.get("indication", ""),
        "sponsorName": p.get("sponsorName", ""),
        "sampleSize": p.get("sampleSize"),
        "status": p.get("status", "Draft"),
        "version": p.get("version", "1.0"),
        "templateId": p.get("templateId"),
        "studyDesignData": {},  # Design data is read via /design and /schedule endpoints
        "narrativeSections": narrative,
        "referenceTrials": [],  # Reference trials are read via /references endpoint
        "createdAt": p.get("createdAt", ""),
        "updatedAt": p.get("updatedAt", ""),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("")
async def create_protocol(body: ProtocolCreateRequest):
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
    try:
        template_data = template_service.create_protocol_from_template(body.template, overrides)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
        "narrativeSections": template_data.get("narrative_sections", {}),
    }

    try:
        async with get_session() as session:
            p = await graph_crud.create_protocol(session, data)
            protocol_id = p.get("id", data["id"])

            # Save design + schedule entities if template provided them
            sdd = template_data.get("study_design_data", {})
            if sdd:
                await graph_crud.save_design(session, protocol_id, sdd)
                await graph_crud.save_schedule(session, protocol_id, sdd)
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        logger.error(
            "Failed to create protocol %s: %s\n%s",
            body.protocolNumber, e, traceback.format_exc(),
        )
        # Check for Neo4j constraint violation (duplicate protocolNumber)
        if "ConstraintValidation" in err_msg or "already exists" in err_msg:
            raise HTTPException(
                status_code=409,
                detail=f"A protocol with number '{body.protocolNumber}' already exists.",
            )
        raise HTTPException(
            status_code=502,
            detail="Failed to create protocol. Please ensure Neo4j is running and try again.",
        )

    return _graph_to_full(p)


@router.get("")
async def list_protocols():
    """List all protocols with summary info."""
    async with get_session() as session:
        protocols = await graph_crud.list_protocols(session)
    return [_graph_to_summary(p) for p in protocols]


@router.get("/{protocol_id}")
async def get_protocol(protocol_id: str):
    """Get full protocol including study_design_data and narrative_sections."""
    async with get_session() as session:
        p = await graph_crud.get_protocol(session, protocol_id)
    if not p:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return _graph_to_full(p)


@router.put("/{protocol_id}")
async def update_protocol(protocol_id: str, body: ProtocolUpdateRequest):
    """Update protocol metadata (not design data). Accepts any subset of fields."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    async with get_session() as session:
        p = await graph_crud.update_protocol(session, protocol_id, update_data)
    if not p:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return _graph_to_full(p)


@router.delete("/{protocol_id}")
async def delete_protocol(protocol_id: str):
    """Delete a protocol."""
    async with get_session() as session:
        deleted = await graph_crud.delete_protocol(session, protocol_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return {"deleted": True, "id": protocol_id}
