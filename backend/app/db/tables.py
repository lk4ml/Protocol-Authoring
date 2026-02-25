from sqlalchemy import Column, String, DateTime, Text, JSON, Integer
from datetime import datetime, timezone

from ..database import Base


class ProtocolDB(Base):
    __tablename__ = "protocols"

    id = Column(String, primary_key=True)
    protocol_number = Column(String, unique=True, index=True)
    short_title = Column(String, default="")
    full_title = Column(Text, default="")
    phase = Column(String, default="")
    study_type = Column(String, default="Interventional")
    therapeutic_area = Column(String, default="")
    indication = Column(String, default="")
    sponsor_name = Column(String, default="")
    status = Column(String, default="Draft")
    version = Column(String, default="1.0")
    sample_size = Column(Integer, nullable=True)
    template_id = Column(String, nullable=True)

    # Full USDM v3.0 study design data as JSON
    study_design_data = Column(JSON, default=dict)
    # ICH M11 narrative sections (free text per section)
    narrative_sections = Column(JSON, default=dict)
    # Reference trials from ClinicalTrials.gov (array of parsed trial objects)
    reference_trials = Column(JSON, default=list)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    sdr_study_id = Column(String, nullable=True)
