from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .config import settings
from .database import engine, Base
from .routers import protocols, design, schedule, terminology, templates, export, references, ctgov_proxy

Base.metadata.create_all(bind=engine)

# Auto-migrate existing databases — add columns that were introduced after initial schema
_inspector = inspect(engine)
_existing_cols = [c["name"] for c in _inspector.get_columns("protocols")]
if "reference_trials" not in _existing_cols:
    with engine.connect() as _conn:
        _conn.execute(text("ALTER TABLE protocols ADD COLUMN reference_trials JSON DEFAULT '[]'"))
        _conn.commit()

app = FastAPI(
    title="Protocol Authoring Platform",
    description="ICH M11 / USDM v3.0 compliant clinical trial protocol authoring",
    version="1.0.0",
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
def health_check():
    return {"status": "ok"}
