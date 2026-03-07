"""
Study design router — Neo4j graph-only.

Reads/writes design entities (arms, epochs, cells, elements, markers,
flow overrides, objectives, eligibility criteria) to the Neo4j graph.

Includes audit trail recording and versioning snapshots on save.
"""

import logging

from fastapi import APIRouter, HTTPException

from ..graph import get_session
from ..graph import crud as graph_crud
from ..graph import audit
from ..graph import versioning
from ..models.requests import StudyDesignUpdateRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# Keys that belong to the study design portion
DESIGN_KEYS = [
    "studyArms",
    "studyEpochs",
    "studyCells",
    "studyElements",
    "studyMarkers",
    "studyFlowOverrides",
    "interventionModel",
    "blindingSchema",
    "eligibilityCriteria",
    "objectives",
]

# Map design list-keys -> entity type names for versioning
_DESIGN_ENTITY_MAP = {
    "studyArms": "StudyArm",
    "studyEpochs": "StudyEpoch",
    "studyElements": "StudyElement",
    "studyCells": "StudyCell",
    "studyMarkers": "StudyMarker",
    "studyFlowOverrides": "StudyFlowOverride",
    "objectives": "Objective",
}


@router.get("/{protocol_id}/design")
async def get_study_design(protocol_id: str):
    """Return the study design portion from the graph."""
    async with get_session() as session:
        design = await graph_crud.get_design(session, protocol_id)
    if design is None:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return design


@router.put("/{protocol_id}/design")
async def update_study_design(
    protocol_id: str,
    body: StudyDesignUpdateRequest,
):
    """
    Save the full study design.

    Validates incoming data via StudyDesignUpdateRequest (Pydantic).
    Merges only provided keys — graph CRUD uses MERGE/upsert per-key.

    After save, records audit trail and creates versioning snapshots.
    """
    async with get_session() as session:
        # Check protocol exists
        proto = await graph_crud.get_protocol(session, protocol_id)
        if not proto:
            raise HTTPException(status_code=404, detail="Protocol not found")

        # Build the data payload with only provided keys
        payload = body.model_dump(exclude_none=True)

        # For merge semantics: read current design, then overlay new keys
        # This ensures we don't clobber schedule or other keys
        current_design = await graph_crud.get_design(session, protocol_id) or {}

        merged = {}
        for key in DESIGN_KEYS:
            if key in payload:
                merged[key] = payload[key]
            elif key in current_design:
                merged[key] = current_design[key]

        # Save to graph (save_design handles each key independently)
        await graph_crud.save_design(session, protocol_id, merged)

        # --- Audit trail (non-blocking) ---
        try:
            entity_parts = []
            total_count = 0
            for key in DESIGN_KEYS:
                val = merged.get(key)
                if isinstance(val, list):
                    entity_parts.append(f"{len(val)} {key}")
                    total_count += len(val)
                elif isinstance(val, dict) and key == "eligibilityCriteria":
                    inc = len(val.get("inclusion", []))
                    exc = len(val.get("exclusion", []))
                    entity_parts.append(f"{inc + exc} eligibilityCriteria")
                    total_count += inc + exc
            description = f"Design save: {', '.join(entity_parts)}" if entity_parts else "Design save"
            await audit.record_bulk_action(
                session, protocol_id,
                action_type="UPDATE",
                entity_type="Design",
                entity_count=total_count,
                description=description,
            )
        except Exception as e:
            logger.warning(f"Audit recording failed (non-blocking): {e}")

        # --- Versioning snapshots (non-blocking) ---
        try:
            await versioning.ensure_protocol_root(session, protocol_id)
            for key, entity_type in _DESIGN_ENTITY_MAP.items():
                entities = merged.get(key, [])
                if isinstance(entities, list) and entities:
                    await versioning.bulk_version_entities(
                        session, entity_type, protocol_id, entities,
                        id_field="id",
                    )
            # EligibilityCriteria — flatten dict form to list for versioning
            ec = merged.get("eligibilityCriteria")
            if ec:
                if isinstance(ec, dict):
                    criteria = ec.get("inclusion", []) + ec.get("exclusion", [])
                elif isinstance(ec, list):
                    criteria = ec
                else:
                    criteria = []
                if criteria:
                    await versioning.bulk_version_entities(
                        session, "EligibilityCriterion", protocol_id, criteria,
                        id_field="id",
                    )
        except Exception as e:
            logger.warning(f"Versioning snapshot failed (non-blocking): {e}")

        # Read back the saved design to return to caller
        result = await graph_crud.get_design(session, protocol_id)

    return result or {}
