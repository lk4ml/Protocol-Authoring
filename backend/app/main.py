import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .routers import protocols, design, schedule, terminology, templates, export, references, ctgov_proxy

logger = logging.getLogger(__name__)

# Create SQLite tables if they don't exist (safe for development).
# For production, use: alembic upgrade head
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle: initialize Neo4j driver + schema."""
    try:
        from .graph import get_driver, close_driver, verify_connectivity
        from .graph.schema import ensure_constraints

        driver = await get_driver()
        await verify_connectivity()
        await ensure_constraints(driver)
        logger.info("Neo4j connected and schema initialized")
    except Exception as e:
        # Neo4j is optional during Phase 1 — log and continue with SQLite only
        logger.warning(f"Neo4j not available ({e}). Running in SQLite-only mode.")

    yield

    # Shutdown
    try:
        from .graph import close_driver
        await close_driver()
    except Exception:
        pass


app = FastAPI(
    title="Protocol Authoring Platform",
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


@app.get("/api/health")
async def health_check():
    status = {"status": "ok", "version": "2.0.0", "database": "sqlite"}
    try:
        from .graph import verify_connectivity
        await verify_connectivity()
        status["graph"] = "neo4j_connected"
    except Exception:
        status["graph"] = "not_connected"
    return status
