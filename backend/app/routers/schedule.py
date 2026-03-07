"""
Schedule / SOA router — Neo4j graph-only.

Reads/writes schedule entities (encounters, activities, timelines,
SOA groups, activity groups) to the Neo4j graph.

Includes audit trail recording and versioning snapshots on save.
"""

import logging

from fastapi import APIRouter, HTTPException

from ..graph import get_session
from ..graph import crud as graph_crud
from ..graph import audit
from ..graph import versioning
from ..models.requests import ScheduleUpdateRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# Keys that belong to the schedule / SOA portion
SCHEDULE_KEYS = [
    "encounters",
    "activities",
    "scheduleTimelines",
    "soaGroups",
    "activityGroups",
]

# Map schedule keys -> entity type names for versioning
_SCHEDULE_ENTITY_MAP = {
    "encounters": "Encounter",
    "activities": "Activity",
    "soaGroups": "SoaGroup",
    "activityGroups": "ActivityGroup",
    "scheduleTimelines": "ScheduleTimeline",
}


@router.get("/{protocol_id}/schedule")
async def get_schedule(protocol_id: str):
    """Return the schedule portion (encounters, activities, timelines) from the graph."""
    async with get_session() as session:
        schedule = await graph_crud.get_schedule(session, protocol_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return schedule


@router.put("/{protocol_id}/schedule")
async def update_schedule(
    protocol_id: str,
    body: ScheduleUpdateRequest,
):
    """
    Save the full schedule data.

    Validates and normalizes incoming data through ScheduleUpdateRequest:
    - Converts legacy activityId (singular) -> activityIds (list)
    - Converts legacy conditionality -> defaultConditionId
    - Validates all required fields via Pydantic

    After save, records audit trail and creates versioning snapshots.
    """
    async with get_session() as session:
        # Check protocol exists
        proto = await graph_crud.get_protocol(session, protocol_id)
        if not proto:
            raise HTTPException(status_code=404, detail="Protocol not found")

        # Build the data payload with only provided keys
        payload = body.model_dump(exclude_none=True)

        # For merge semantics: read current schedule, then overlay new keys
        current_schedule = await graph_crud.get_schedule(session, protocol_id) or {}

        merged = {}
        for key in SCHEDULE_KEYS:
            if key in payload:
                merged[key] = payload[key]
            elif key in current_schedule:
                merged[key] = current_schedule[key]

        # Save to graph (MERGE/upsert strategy)
        await graph_crud.save_schedule(session, protocol_id, merged)

        # --- Audit trail (non-blocking) ---
        try:
            entity_parts = []
            total_count = 0
            for key in SCHEDULE_KEYS:
                items = merged.get(key, [])
                if isinstance(items, list):
                    entity_parts.append(f"{len(items)} {key}")
                    total_count += len(items)
            description = f"Schedule save: {', '.join(entity_parts)}" if entity_parts else "Schedule save"
            await audit.record_bulk_action(
                session, protocol_id,
                action_type="UPDATE",
                entity_type="Schedule",
                entity_count=total_count,
                description=description,
            )
        except Exception as e:
            logger.warning(f"Audit recording failed (non-blocking): {e}")

        # --- Versioning snapshots (non-blocking) ---
        try:
            await versioning.ensure_protocol_root(session, protocol_id)
            for key, entity_type in _SCHEDULE_ENTITY_MAP.items():
                entities = merged.get(key, [])
                if isinstance(entities, list) and entities:
                    await versioning.bulk_version_entities(
                        session, entity_type, protocol_id, entities,
                        id_field="id",
                    )
        except Exception as e:
            logger.warning(f"Versioning snapshot failed (non-blocking): {e}")

        # Read back the saved schedule
        result = await graph_crud.get_schedule(session, protocol_id)

    return result or {}
