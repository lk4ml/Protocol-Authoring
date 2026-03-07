"""
Reference Trials Router — Neo4j graph-only.

CRUD for reference trials attached to a protocol.
Reference trials are stored as ReferenceTrial nodes in the graph,
linked to Protocol via REFERENCES_TRIAL relationships.
"""

import logging
import traceback
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..graph import get_session
from ..graph import crud as graph_crud
from ..models.requests import ReferenceTrialRequest

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{protocol_id}/references")
async def get_references(protocol_id: str):
    """Return all reference trials for a protocol."""
    try:
        async with get_session() as session:
            proto = await graph_crud.get_protocol(session, protocol_id)
            if not proto:
                raise HTTPException(status_code=404, detail="Protocol not found")
            return await graph_crud.get_reference_trials(session, protocol_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get references for protocol %s: %s\n%s",
            protocol_id, e, traceback.format_exc(),
        )
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the graph database. Please ensure Neo4j is running.",
        )


@router.post("/{protocol_id}/references")
async def add_reference(protocol_id: str, body: ReferenceTrialRequest):
    """Add a parsed reference trial. Rejects duplicates by nctId."""
    try:
        async with get_session() as session:
            proto = await graph_crud.get_protocol(session, protocol_id)
            if not proto:
                raise HTTPException(status_code=404, detail="Protocol not found")

            # Check for duplicates
            existing = await graph_crud.get_reference_trials(session, protocol_id)
            if any(r.get("nctId") == body.nctId for r in existing):
                raise HTTPException(status_code=409, detail="Trial already added as reference")

            # Build trial data (field normalization handled by Pydantic model validator)
            trial_data = body.model_dump()
            all_trials = existing + [trial_data]
            await graph_crud.save_reference_trials(session, protocol_id, all_trials)

            return all_trials
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to add reference %s to protocol %s: %s\n%s",
            body.nctId, protocol_id, e, traceback.format_exc(),
        )
        raise HTTPException(
            status_code=502,
            detail=f"Failed to save reference trial {body.nctId}. "
                   "Please ensure Neo4j is running and try again.",
        )


@router.delete("/{protocol_id}/references/{nct_id}")
async def remove_reference(protocol_id: str, nct_id: str):
    """Remove a reference trial by NCT ID."""
    try:
        async with get_session() as session:
            proto = await graph_crud.get_protocol(session, protocol_id)
            if not proto:
                raise HTTPException(status_code=404, detail="Protocol not found")

            existing = await graph_crud.get_reference_trials(session, protocol_id)
            before_count = len(existing)
            remaining = [r for r in existing if r.get("nctId") != nct_id]

            if len(remaining) == before_count:
                raise HTTPException(status_code=404, detail="Reference trial not found")

            await graph_crud.save_reference_trials(session, protocol_id, remaining)
            return {"removed": nct_id, "remaining": len(remaining)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to remove reference %s from protocol %s: %s\n%s",
            nct_id, protocol_id, e, traceback.format_exc(),
        )
        raise HTTPException(
            status_code=502,
            detail=f"Failed to remove reference trial {nct_id}. "
                   "Please ensure Neo4j is running and try again.",
        )
