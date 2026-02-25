from sqlalchemy.orm import Session
from datetime import datetime, timezone

from .tables import ProtocolDB
from ..models.common import new_id


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
    return protocol


def update_study_design(db: Session, protocol_id: str, design_data: dict) -> ProtocolDB | None:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return None
    protocol.study_design_data = design_data
    protocol.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(protocol)
    return protocol


def delete_protocol(db: Session, protocol_id: str) -> bool:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return False
    db.delete(protocol)
    db.commit()
    return True


def _to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    import re
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
