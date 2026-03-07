"""
Export router — Neo4j graph-only.

Provides USDM JSON and ICH M11 Word document export.
Uses a ProtocolProxy object to present graph data with attribute access
compatible with the USDM assembler and document generator.
"""

import io
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..graph import get_session
from ..graph import crud as graph_crud
from ..services.usdm_assembler import assemble_usdm
from ..services.document_generator import generate_protocol_document

router = APIRouter()
logger = logging.getLogger(__name__)


class ProtocolProxy:
    """
    Adapter that presents Neo4j graph data with the same attribute access
    as the old SQLAlchemy ProtocolDB model.

    This allows the USDM assembler and document generator to work unchanged.
    """

    def __init__(self, proto: dict, design: dict, schedule: dict, refs: list):
        self.id = proto.get("id", "")
        self.protocol_number = proto.get("protocolNumber", "")
        self.short_title = proto.get("shortTitle", "")
        self.full_title = proto.get("fullTitle", "")
        self.phase = proto.get("phase", "")
        self.study_type = proto.get("studyType", "")
        self.therapeutic_area = proto.get("therapeuticArea", "")
        self.indication = proto.get("indication", "")
        self.sponsor_name = proto.get("sponsorName", "")
        self.status = proto.get("status", "Draft")
        self.version = proto.get("version", "1.0")
        self.sample_size = proto.get("sampleSize")
        self.template_id = proto.get("templateId")

        # Reconstruct narrative_sections from JSON string if needed
        narrative = proto.get("narrativeSections", "{}")
        if isinstance(narrative, str):
            try:
                narrative = json.loads(narrative)
            except (json.JSONDecodeError, TypeError):
                narrative = {}
        self.narrative_sections = narrative

        # Combine design + schedule into study_design_data
        sdd = {}
        sdd.update(design or {})
        sdd.update(schedule or {})
        self.study_design_data = sdd

        self.reference_trials = refs or []

        self.created_at = proto.get("createdAt")
        self.updated_at = proto.get("updatedAt")
        self.sdr_study_id = None


async def _load_protocol_proxy(protocol_id: str) -> ProtocolProxy:
    """Load all graph data and return a ProtocolProxy."""
    async with get_session() as session:
        proto = await graph_crud.get_protocol(session, protocol_id)
        if not proto:
            raise HTTPException(status_code=404, detail="Protocol not found")
        design = await graph_crud.get_design(session, protocol_id) or {}
        schedule = await graph_crud.get_schedule(session, protocol_id) or {}
        refs = await graph_crud.get_reference_trials(session, protocol_id)
    return ProtocolProxy(proto, design, schedule, refs)


@router.get("/{protocol_id}/export/usdm")
async def export_usdm(protocol_id: str):
    proxy = await _load_protocol_proxy(protocol_id)
    return assemble_usdm(proxy)


@router.get("/{protocol_id}/export/ich-m11")
async def export_ich_m11(protocol_id: str, format: str = "docx"):
    proxy = await _load_protocol_proxy(protocol_id)
    doc = generate_protocol_document(proxy)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    filename = f"{proxy.protocol_number}_ICH_M11.docx"

    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
