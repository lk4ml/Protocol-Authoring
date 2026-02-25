from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from ..database import get_db
from ..db import crud
from ..services.usdm_assembler import assemble_usdm
from ..services.document_generator import generate_protocol_document

router = APIRouter()


@router.get("/{protocol_id}/export/usdm")
def export_usdm(protocol_id: str, db: Session = Depends(get_db)):
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return assemble_usdm(protocol)


@router.get("/{protocol_id}/export/ich-m11")
def export_ich_m11(
    protocol_id: str,
    format: str = "docx",
    db: Session = Depends(get_db),
):
    protocol = crud.get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    doc = generate_protocol_document(protocol)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    filename = f"{protocol.protocol_number}_ICH_M11.docx"

    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
