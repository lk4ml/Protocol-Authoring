"""
Activity Concept Library API endpoints.

Cross-study reusable activity definitions organized as:
  Group → SubGroup → Concept → Instance

Concepts link to CDISC BiomedicalConcepts, CT terms, and SDTM domains.
"""

import logging
from fastapi import APIRouter, HTTPException, Query

from ..graph import get_session
from ..graph import library

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/library", tags=["Activity Library"])


@router.get("/groups")
async def list_groups():
    """List all activity groups with subgroup counts."""
    try:
        async with get_session() as session:
            return await library.list_groups(session)
    except Exception as e:
        logger.error(f"Library group query failed: {e}")
        raise HTTPException(status_code=503, detail="Activity library not available")


@router.get("/groups/{group_id}")
async def get_group(group_id: str):
    """Get an activity group with all subgroups and concept counts."""
    try:
        async with get_session() as session:
            group = await library.get_group_with_subgroups(session, group_id)
            if not group:
                raise HTTPException(status_code=404, detail="Group not found")
            return group
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Library group detail query failed: {e}")
        raise HTTPException(status_code=503, detail="Activity library not available")


@router.get("/concepts")
async def list_concepts(
    subgroup: str = Query(None, description="Filter by subgroup ID"),
    domain: str = Query(None, description="Filter by SDTM domain code"),
    search: str = Query(None, description="Search by name or NCI code"),
    ta: str = Query(None, description="Filter by therapeutic area"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List activity concepts with filters."""
    try:
        async with get_session() as session:
            return await library.list_concepts(
                session, subgroup_id=subgroup, domain=domain,
                search=search, therapeutic_area=ta,
                limit=limit, offset=offset,
            )
    except Exception as e:
        logger.error(f"Library concept query failed: {e}")
        raise HTTPException(status_code=503, detail="Activity library not available")


@router.get("/concepts/{concept_id}")
async def get_concept(concept_id: str):
    """Get an activity concept with all relationships (BC, domain, data elements)."""
    try:
        async with get_session() as session:
            concept = await library.get_concept(session, concept_id)
            if not concept:
                raise HTTPException(status_code=404, detail="Concept not found")
            return concept
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Library concept detail query failed: {e}")
        raise HTTPException(status_code=503, detail="Activity library not available")


@router.get("/search")
async def search_library(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(30, ge=1, le=100),
):
    """Full-text search across the activity library."""
    try:
        async with get_session() as session:
            return await library.search_library(session, query=q, limit=limit)
    except Exception as e:
        logger.error(f"Library search failed: {e}")
        raise HTTPException(status_code=503, detail="Activity library not available")


@router.get("/stats")
async def get_library_stats():
    """Get counts of all library node types."""
    try:
        async with get_session() as session:
            return await library.get_library_stats(session)
    except Exception as e:
        logger.error(f"Library stats query failed: {e}")
        raise HTTPException(status_code=503, detail="Activity library not available")


@router.post("/link/{activity_id}")
async def link_activity_to_concept(
    activity_id: str,
    concept_id: str = Query(..., description="Library concept ID to link to"),
):
    """Link a study-level activity to a library concept."""
    try:
        async with get_session() as session:
            ok = await library.link_study_activity_to_concept(
                session, activity_id, concept_id
            )
            if not ok:
                raise HTTPException(
                    status_code=404,
                    detail="Activity or concept not found"
                )
            return {"status": "linked", "activityId": activity_id,
                    "conceptId": concept_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Activity-concept link failed: {e}")
        raise HTTPException(status_code=503, detail="Activity library not available")
