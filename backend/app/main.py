import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import protocols, design, schedule, terminology, templates, export, references, ctgov_proxy, ct, versions, audit, library

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle: initialize Neo4j driver + schema."""
    from .graph import get_driver, close_driver, verify_connectivity
    from .graph.schema import ensure_constraints

    driver = await get_driver()
    await verify_connectivity()
    await ensure_constraints(driver)
    logger.info("Neo4j connected and schema initialized")

    # Load CDISC CT into graph (idempotent — skips if already loaded)
    try:
        from .graph.ct_loader import load_all_ct
        ct_counts = await load_all_ct(driver)
        logger.info(f"CDISC CT status: {ct_counts}")
    except Exception as ct_err:
        logger.warning(f"CT loading skipped ({ct_err})")

    # Load Activity Concept Library (idempotent)
    try:
        from .graph.library import load_activity_library
        lib_counts = await load_activity_library(driver)
        logger.info(f"Activity library status: {lib_counts}")
    except Exception as lib_err:
        logger.warning(f"Library loading skipped ({lib_err})")

    yield

    # Shutdown
    await close_driver()


app = FastAPI(
    title="ProtoHelix",
    description="ICH M11 / USDM v3.0 compliant clinical trial protocol authoring",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(protocols.router, prefix="/api/protocols", tags=["Protocols"])
app.include_router(design.router, prefix="/api/protocols", tags=["Study Design"])
app.include_router(schedule.router, prefix="/api/protocols", tags=["Schedule / SOA"])
app.include_router(terminology.router, prefix="/api/terminology", tags=["Terminology"])
app.include_router(templates.router, prefix="/api/templates", tags=["Templates"])
app.include_router(export.router, prefix="/api/protocols", tags=["Export"])
app.include_router(references.router, prefix="/api/protocols", tags=["Reference Trials"])
app.include_router(ctgov_proxy.router, prefix="/api/ctgov", tags=["ClinicalTrials.gov Proxy"])
app.include_router(ct.router, tags=["Controlled Terminology"])
app.include_router(versions.router, tags=["Versioning"])
app.include_router(audit.router, tags=["Audit Trail"])
app.include_router(library.router, tags=["Activity Library"])


@app.get("/api/health")
async def health_check():
    from .graph import verify_connectivity, get_session

    status = {"status": "ok", "version": "3.0.0", "database": "neo4j"}
    try:
        await verify_connectivity()
        status["graph"] = "neo4j_connected"
        # CT stats
        try:
            from .graph import ct_crud
            async with get_session() as session:
                ct_stats = await ct_crud.get_ct_stats(session)
                status["ct"] = ct_stats
        except Exception:
            status["ct"] = "not_loaded"
    except Exception:
        status["graph"] = "not_connected"
        status["status"] = "degraded"
    return status
