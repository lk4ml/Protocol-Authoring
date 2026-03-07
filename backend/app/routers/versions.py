"""
Protocol version management API endpoints.

Implements Root-Value versioning lifecycle:
- View version history
- Finalize draft → final
- Create new draft from final
- View specific version snapshots
- Retire versions
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..graph import get_session
from ..graph import versioning

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/protocols", tags=["Versioning"])


class FinalizeRequest(BaseModel):
    authorId: str = "system"


class NewVersionRequest(BaseModel):
    authorId: str = "system"


# ---------------------------------------------------------------------------
# Version history & status
# ---------------------------------------------------------------------------

@router.get("/{protocol_id}/versions")
async def get_version_history(protocol_id: str):
    """Get all versions for a protocol with metadata."""
    try:
        async with get_session() as session:
            history = await versioning.get_protocol_version_history(
                session, protocol_id
            )
            status = await versioning.get_protocol_status(
                session, protocol_id
            )
            return {
                "protocolId": protocol_id,
                "currentStatus": status,
                "versions": history,
            }
    except Exception as e:
        logger.error(f"Version history query failed: {e}")
        raise HTTPException(status_code=503, detail="Versioning not available")


@router.get("/{protocol_id}/versions/status")
async def get_version_status(protocol_id: str):
    """Get current versioning state (which pointers exist)."""
    try:
        async with get_session() as session:
            status = await versioning.get_protocol_status(
                session, protocol_id
            )
            if not status.get("uid"):
                raise HTTPException(status_code=404,
                                    detail="Protocol not found in version store")
            return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Version status query failed: {e}")
        raise HTTPException(status_code=503, detail="Versioning not available")


@router.get("/{protocol_id}/versions/{version}")
async def get_specific_version(protocol_id: str, version: int):
    """Get a specific version's snapshot."""
    try:
        async with get_session() as session:
            val = await versioning.get_version(
                session, "ProtocolRoot", protocol_id, version
            )
            if not val:
                raise HTTPException(
                    status_code=404,
                    detail=f"Version {version} not found for protocol {protocol_id}"
                )
            return val
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Version snapshot query failed: {e}")
        raise HTTPException(status_code=503, detail="Versioning not available")


# ---------------------------------------------------------------------------
# Version lifecycle actions
# ---------------------------------------------------------------------------

@router.post("/{protocol_id}/versions/finalize")
async def finalize_version(protocol_id: str, body: FinalizeRequest = None):
    """Finalize current DRAFT → FINAL.

    This locks the current draft as an approved version.
    No further edits until a new version is created.
    """
    author = body.authorId if body else "system"
    try:
        async with get_session() as session:
            result = await versioning.finalize_protocol(
                session, protocol_id, author_id=author
            )
            if not result:
                raise HTTPException(
                    status_code=400,
                    detail="No DRAFT found to finalize. Protocol may already be finalized."
                )
            return {
                "status": "finalized",
                "protocolId": protocol_id,
                **result,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Finalize failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{protocol_id}/versions/new")
async def create_new_version(protocol_id: str, body: NewVersionRequest = None):
    """Create a new DRAFT version from the latest FINAL.

    Clones the finalized properties into a new editable draft.
    """
    author = body.authorId if body else "system"
    try:
        async with get_session() as session:
            result = await versioning.create_new_protocol_version(
                session, protocol_id, author_id=author
            )
            if not result:
                raise HTTPException(
                    status_code=400,
                    detail="No FINAL version found. Finalize the current draft first."
                )
            return {
                "status": "new_draft_created",
                "protocolId": protocol_id,
                **result,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"New version creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{protocol_id}/versions/retire")
async def retire_version(protocol_id: str, body: FinalizeRequest = None):
    """Retire the current FINAL version.

    Marks the version as deprecated. Cannot be edited.
    """
    author = body.authorId if body else "system"
    try:
        async with get_session() as session:
            result = await versioning.retire_version(
                session, "ProtocolRoot", protocol_id, author_id=author
            )
            if not result:
                raise HTTPException(
                    status_code=400,
                    detail="No FINAL version found to retire."
                )
            return {
                "status": "retired",
                "protocolId": protocol_id,
                **result,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retire failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
