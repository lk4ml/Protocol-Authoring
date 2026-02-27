import asyncio
import logging
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .tables import ProtocolDB
from ..models.common import new_id

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------
# Neo4j dual-write helpers (Phase 1: best-effort, non-blocking)
# -----------------------------------------------------------------------

def _fire_graph_write(coro):
    """
    Schedule an async graph write in the background.

    If Neo4j is unavailable, the error is logged and swallowed.
    SQLite remains the source of truth during Phase 1.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No event loop — skip graph write (happens in sync test contexts)
        return

    async def _safe():
        try:
            await coro
        except Exception as e:
            logger.warning(f"Graph dual-write failed: {e}")

    loop.create_task(_safe())


async def _graph_save_protocol(data: dict):
    """Write a Protocol node to Neo4j."""
    from ..graph import get_session
    from ..graph import crud as graph_crud
    async with get_session() as session:
        await graph_crud.create_protocol(session, data)


async def _graph_save_design(protocol_id: str, design_data: dict):
    """Write design + schedule entities to Neo4j."""
    from ..graph import get_session
    from ..graph import crud as graph_crud
    async with get_session() as session:
        await graph_crud.save_design(session, protocol_id, design_data)
        await graph_crud.save_schedule(session, protocol_id, design_data)


async def _graph_save_references(protocol_id: str, trials: list):
    """Write reference trials to Neo4j."""
    from ..graph import get_session
    from ..graph import crud as graph_crud
    async with get_session() as session:
        await graph_crud.save_reference_trials(session, protocol_id, trials)


async def _graph_delete_protocol(protocol_id: str):
    """Delete a Protocol and all children from Neo4j."""
    from ..graph import get_session
    from ..graph import crud as graph_crud
    async with get_session() as session:
        await graph_crud.delete_protocol(session, protocol_id)


async def _graph_update_protocol(protocol_id: str, data: dict):
    """Update scalar fields on a Protocol node in Neo4j."""
    from ..graph import get_session
    from ..graph import crud as graph_crud
    async with get_session() as session:
        await graph_crud.update_protocol(session, protocol_id, data)


# -----------------------------------------------------------------------
# SQLite CRUD (primary)
# -----------------------------------------------------------------------

def create_protocol(db: Session, data: dict) -> ProtocolDB:
    protocol = ProtocolDB(
        id=data.get("id", new_id()),
        protocol_number=data["protocolNumber"],
        short_title=data.get("shortTitle", ""),
        full_title=data.get("fullTitle", ""),
        phase=data.get("phase", ""),
        study_type=data.get("studyType", "Interventional"),
        therapeutic_area=data.get("therapeuticArea", ""),
        indication=data.get("indication", ""),
        sponsor_name=data.get("sponsorName", ""),
        sample_size=data.get("sampleSize"),
        template_id=data.get("templateId"),
        study_design_data=data.get("studyDesignData", {}),
        narrative_sections=data.get("narrativeSections", {}),
    )
    db.add(protocol)
    db.commit()
    db.refresh(protocol)

    # Dual-write to Neo4j
    _fire_graph_write(_graph_save_protocol(data))
    sdd = data.get("studyDesignData", {})
    if sdd:
        _fire_graph_write(_graph_save_design(protocol.id, sdd))

    return protocol


def get_protocol(db: Session, protocol_id: str) -> ProtocolDB | None:
    return db.query(ProtocolDB).filter(ProtocolDB.id == protocol_id).first()


def list_protocols(db: Session) -> list[ProtocolDB]:
    return db.query(ProtocolDB).order_by(ProtocolDB.updated_at.desc()).all()


def update_protocol(db: Session, protocol_id: str, data: dict) -> ProtocolDB | None:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return None

    for key, value in data.items():
        col_name = _to_snake(key)
        if hasattr(protocol, col_name):
            setattr(protocol, col_name, value)

    protocol.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(protocol)

    # Dual-write to Neo4j
    _fire_graph_write(_graph_update_protocol(protocol_id, data))

    return protocol


def update_study_design(db: Session, protocol_id: str, design_data: dict) -> ProtocolDB | None:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return None
    protocol.study_design_data = design_data
    protocol.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(protocol)

    # Dual-write to Neo4j
    _fire_graph_write(_graph_save_design(protocol_id, design_data))

    return protocol


def delete_protocol(db: Session, protocol_id: str) -> bool:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return False
    db.delete(protocol)
    db.commit()

    # Dual-write to Neo4j
    _fire_graph_write(_graph_delete_protocol(protocol_id))

    return True


def _to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
