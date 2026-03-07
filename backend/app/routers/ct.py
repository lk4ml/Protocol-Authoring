"""
CDISC Controlled Terminology API endpoints.

Provides REST access to CT codelists, terms, biomedical concepts,
and SDTM domains stored in Neo4j.
"""

import logging
from fastapi import APIRouter, HTTPException, Query

from ..graph import get_session
from ..graph import ct_crud

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ct", tags=["Controlled Terminology"])


# ---------------------------------------------------------------------------
# Catalogues & Packages
# ---------------------------------------------------------------------------

@router.get("/catalogues")
async def list_catalogues():
    """List all CT catalogues (SDTM CT, ADaM CT, etc.)."""
    try:
        async with get_session() as session:
            return await ct_crud.list_catalogues(session)
    except Exception as e:
        logger.error(f"CT catalogue query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


@router.get("/packages")
async def list_packages(catalogue: str = Query(None)):
    """List CT packages, optionally filtered by catalogue name."""
    try:
        async with get_session() as session:
            return await ct_crud.list_packages(session, catalogue=catalogue)
    except Exception as e:
        logger.error(f"CT package query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


@router.get("/packages/latest")
async def get_latest_package(standard: str = Query("SDTM")):
    """Get the most recent CT package for a standard."""
    try:
        async with get_session() as session:
            pkg = await ct_crud.get_latest_package(session, standard=standard)
            if not pkg:
                raise HTTPException(status_code=404,
                                    detail=f"No packages found for {standard}")
            return pkg
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CT latest package query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


# ---------------------------------------------------------------------------
# Codelists
# ---------------------------------------------------------------------------

@router.get("/codelists")
async def list_codelists(
    search: str = Query(None, description="Search by name, submission value, or concept ID"),
    package: str = Query(None, description="Filter by package href"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List CT codelists with optional search and package filter."""
    try:
        async with get_session() as session:
            return await ct_crud.list_codelists(
                session, search=search, package_href=package,
                limit=limit, offset=offset
            )
    except Exception as e:
        logger.error(f"CT codelist query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


@router.get("/codelists/{concept_id}")
async def get_codelist(concept_id: str):
    """Get a codelist with all its terms."""
    try:
        async with get_session() as session:
            cl = await ct_crud.get_codelist(session, concept_id)
            if not cl:
                raise HTTPException(status_code=404,
                                    detail=f"Codelist {concept_id} not found")
            return cl
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CT codelist detail query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


# ---------------------------------------------------------------------------
# Terms
# ---------------------------------------------------------------------------

@router.get("/terms")
async def search_terms(
    q: str = Query(..., min_length=1, description="Search query"),
    codelist: str = Query(None, description="Filter by codelist concept ID"),
    limit: int = Query(50, ge=1, le=200),
):
    """Search CT terms by submission value, preferred term, or concept ID."""
    try:
        async with get_session() as session:
            return await ct_crud.search_terms(
                session, query=q, codelist_id=codelist, limit=limit
            )
    except Exception as e:
        logger.error(f"CT term search failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


@router.get("/terms/{concept_id}")
async def get_term(concept_id: str):
    """Get a single CT term with parent codelist info."""
    try:
        async with get_session() as session:
            term = await ct_crud.get_term(session, concept_id)
            if not term:
                raise HTTPException(status_code=404,
                                    detail=f"Term {concept_id} not found")
            return term
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CT term detail query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


# ---------------------------------------------------------------------------
# Biomedical Concepts
# ---------------------------------------------------------------------------

@router.get("/biomedical-concepts")
async def list_biomedical_concepts(
    category: str = Query(None, description="Filter by primary category"),
    search: str = Query(None, description="Search by short name or concept ID"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List biomedical concepts with optional filters."""
    try:
        async with get_session() as session:
            return await ct_crud.list_biomedical_concepts(
                session, category=category, search=search,
                limit=limit, offset=offset
            )
    except Exception as e:
        logger.error(f"BC query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


@router.get("/biomedical-concepts/categories")
async def list_bc_categories():
    """List all unique BC categories with counts."""
    try:
        async with get_session() as session:
            return await ct_crud.list_bc_categories(session)
    except Exception as e:
        logger.error(f"BC category query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


@router.get("/biomedical-concepts/{concept_id}")
async def get_biomedical_concept(concept_id: str):
    """Get a single biomedical concept with data elements and relationships."""
    try:
        async with get_session() as session:
            bc = await ct_crud.get_biomedical_concept(session, concept_id)
            if not bc:
                raise HTTPException(status_code=404,
                                    detail=f"BC {concept_id} not found")
            return bc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"BC detail query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


# ---------------------------------------------------------------------------
# SDTM Domains
# ---------------------------------------------------------------------------

@router.get("/sdtm-domains")
async def list_sdtm_domains():
    """List all SDTM domains with associated BC counts."""
    try:
        async with get_session() as session:
            return await ct_crud.list_sdtm_domains(session)
    except Exception as e:
        logger.error(f"SDTM domain query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


# ---------------------------------------------------------------------------
# Study CT binding
# ---------------------------------------------------------------------------

@router.post("/bind/{protocol_id}")
async def bind_study_ct(protocol_id: str, package_href: str = Query(...)):
    """Bind a study to a specific CT package version."""
    try:
        async with get_session() as session:
            ok = await ct_crud.bind_study_to_ct_package(
                session, protocol_id, package_href
            )
            if not ok:
                raise HTTPException(status_code=404,
                                    detail="Protocol or package not found")
            return {"status": "bound", "protocolId": protocol_id,
                    "packageHref": package_href}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CT binding failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


@router.get("/binding/{protocol_id}")
async def get_study_ct_binding(protocol_id: str):
    """Get the CT package bound to a study."""
    try:
        async with get_session() as session:
            pkg = await ct_crud.get_study_ct_package(session, protocol_id)
            if not pkg:
                return {"protocolId": protocol_id, "package": None,
                        "message": "No CT package bound"}
            return {"protocolId": protocol_id, "package": pkg}
    except Exception as e:
        logger.error(f"CT binding query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_ct_stats():
    """Get counts of all CT node types (admin/health check)."""
    try:
        async with get_session() as session:
            return await ct_crud.get_ct_stats(session)
    except Exception as e:
        logger.error(f"CT stats query failed: {e}")
        raise HTTPException(status_code=503, detail="CT data not available")
