"""
Audit trail API endpoints.

Provides read access to the study change history tracked by StudyAction nodes.
"""

import logging
from fastapi import APIRouter, HTTPException, Query

from ..graph import get_session
from ..graph import audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/protocols", tags=["Audit Trail"])


@router.get("/{protocol_id}/audit")
async def get_audit_trail(
    protocol_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    entity_type: str = Query(None, description="Filter by entity type"),
    action_type: str = Query(None, description="Filter by action type"),
):
    """Get audit trail for a protocol, newest first."""
    try:
        async with get_session() as session:
            actions = await audit.get_audit_trail(
                session, protocol_id,
                limit=limit, offset=offset,
                entity_type=entity_type, action_type=action_type,
            )
            return {"protocolId": protocol_id, "actions": actions}
    except Exception as e:
        logger.error(f"Audit trail query failed: {e}")
        raise HTTPException(status_code=503, detail="Audit trail not available")


@router.get("/{protocol_id}/audit/summary")
async def get_audit_summary(protocol_id: str):
    """Get summary statistics for a protocol's audit trail."""
    try:
        async with get_session() as session:
            return await audit.get_audit_summary(session, protocol_id)
    except Exception as e:
        logger.error(f"Audit summary query failed: {e}")
        raise HTTPException(status_code=503, detail="Audit trail not available")


@router.get("/{protocol_id}/audit/entity/{entity_uid}")
async def get_entity_history(protocol_id: str, entity_uid: str):
    """Get all audit actions for a specific entity."""
    try:
        async with get_session() as session:
            actions = await audit.get_entity_history(
                session, protocol_id, entity_uid
            )
            return {
                "protocolId": protocol_id,
                "entityUid": entity_uid,
                "actions": actions,
            }
    except Exception as e:
        logger.error(f"Entity history query failed: {e}")
        raise HTTPException(status_code=503, detail="Audit trail not available")
