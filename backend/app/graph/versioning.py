"""
Root-Value versioning engine for Neo4j entities.

Implements the OpenStudyBuilder-style versioning pattern where every
entity is split into:
- Root node: stable identity (uid never changes)
- Value node: versioned state snapshot (properties can change)

Pointer relationships for fast access:
- HAS_VERSION: Root → Value (with version, status, startDate metadata)
- LATEST_DRAFT: Root → current draft Value
- LATEST_FINAL: Root → latest approved Value
- LATEST_RETIRED: Root → latest retired Value

Version lifecycle:
  Create → DRAFT → Finalize → FINAL → New Version → DRAFT (v2)
                                    → Retire → RETIRED
"""

import json
import logging
from datetime import datetime, timezone

from neo4j import AsyncSession

logger = logging.getLogger(__name__)

# Version statuses
DRAFT = "DRAFT"
FINAL = "FINAL"
RETIRED = "RETIRED"


# ---------------------------------------------------------------------------
# Core version operations
# ---------------------------------------------------------------------------

async def create_root_value(
    session: AsyncSession,
    root_label: str,
    value_label: str,
    uid: str,
    properties: dict,
    author_id: str = "system",
) -> dict:
    """Create a Root node and its first DRAFT Value node.

    Args:
        root_label: e.g. "ProtocolRoot"
        value_label: e.g. "ProtocolValue"
        uid: unique identifier for the entity
        properties: properties for the Value node
        author_id: who created this
    Returns:
        dict with rootUid, valueId, version, status
    """
    now = _now_iso()
    result = await session.run(f"""
        CREATE (root:{root_label} {{uid: $uid, createdAt: $now}})
        CREATE (val:{value_label} $props)
        SET val.version = 1,
            val.status = '{DRAFT}',
            val.createdAt = $now,
            val.updatedAt = $now
        CREATE (root)-[:HAS_VERSION {{
            version: 1,
            status: '{DRAFT}',
            startDate: $now,
            authorId: $authorId
        }}]->(val)
        CREATE (root)-[:LATEST_DRAFT]->(val)
        RETURN root.uid AS rootUid,
               val.version AS version,
               val.status AS status
    """, uid=uid, props=properties, now=now, authorId=author_id)
    record = await result.single()
    return dict(record) if record else {}


async def update_draft(
    session: AsyncSession,
    root_label: str,
    uid: str,
    properties: dict,
) -> bool:
    """Update properties on the current DRAFT Value node.

    Only works if a DRAFT exists. Raises if no draft found.
    """
    now = _now_iso()
    # Build SET clause dynamically from properties
    set_parts = []
    params = {"uid": uid, "now": now}
    for key, value in properties.items():
        if key in ("version", "status", "createdAt"):
            continue  # Don't overwrite version metadata
        param_name = f"p_{key}"
        set_parts.append(f"val.{key} = ${param_name}")
        params[param_name] = value
    set_parts.append("val.updatedAt = $now")

    if not set_parts:
        return True

    set_clause = ", ".join(set_parts)
    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})-[:LATEST_DRAFT]->(val)
        SET {set_clause}
        RETURN root.uid AS uid
    """, **params)
    record = await result.single()
    return record is not None


async def finalize_version(
    session: AsyncSession,
    root_label: str,
    uid: str,
    author_id: str = "system",
) -> dict:
    """Finalize the current DRAFT → FINAL.

    - Changes status on Value node from DRAFT to FINAL
    - Moves LATEST_FINAL pointer (removes old, creates new)
    - Removes LATEST_DRAFT pointer
    - Sets endDate on any previously FINAL HAS_VERSION relationship
    """
    now = _now_iso()

    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})-[:LATEST_DRAFT]->(draft)
        WHERE draft.status = '{DRAFT}'

        // Update draft status to FINAL
        SET draft.status = '{FINAL}',
            draft.finalizedAt = $now,
            draft.updatedAt = $now

        // Update HAS_VERSION relationship metadata
        WITH root, draft
        MATCH (root)-[hv:HAS_VERSION]->(draft)
        SET hv.status = '{FINAL}',
            hv.finalizedAt = $now,
            hv.authorId = $authorId

        // Remove old LATEST_FINAL if exists
        WITH root, draft
        OPTIONAL MATCH (root)-[oldFinal:LATEST_FINAL]->()
        DELETE oldFinal

        // Set endDate on any previous FINAL versions
        WITH root, draft
        OPTIONAL MATCH (root)-[oldHv:HAS_VERSION]->(oldVal)
        WHERE oldVal <> draft AND oldHv.status = '{FINAL}'
        SET oldHv.endDate = $now, oldHv.status = 'SUPERSEDED',
            oldVal.status = 'SUPERSEDED'

        // Create new LATEST_FINAL pointer
        WITH root, draft
        CREATE (root)-[:LATEST_FINAL]->(draft)

        // Remove LATEST_DRAFT pointer
        WITH root, draft
        MATCH (root)-[ld:LATEST_DRAFT]->(draft)
        DELETE ld

        RETURN root.uid AS rootUid,
               draft.version AS version,
               draft.status AS status
    """, uid=uid, now=now, authorId=author_id)

    record = await result.single()
    if not record:
        logger.warning(f"No DRAFT found to finalize for {root_label} {uid}")
        return {}
    return dict(record)


async def create_new_version(
    session: AsyncSession,
    root_label: str,
    value_label: str,
    uid: str,
    author_id: str = "system",
) -> dict:
    """Create a new DRAFT version by cloning the latest FINAL.

    - Reads properties from LATEST_FINAL
    - Creates new Value node with incremented version
    - Sets up HAS_VERSION + LATEST_DRAFT pointers
    """
    now = _now_iso()

    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})-[:LATEST_FINAL]->(final)

        // Get next version number
        WITH root, final,
             final.version + 1 AS nextVer

        // Clone final properties into new draft
        CREATE (draft:{value_label})
        SET draft = properties(final),
            draft.version = nextVer,
            draft.status = '{DRAFT}',
            draft.createdAt = $now,
            draft.updatedAt = $now

        // Remove finalizedAt from the clone
        REMOVE draft.finalizedAt

        // Create version relationship
        CREATE (root)-[:HAS_VERSION {{
            version: nextVer,
            status: '{DRAFT}',
            startDate: $now,
            authorId: $authorId
        }}]->(draft)

        // Remove old LATEST_DRAFT if exists, set new one
        WITH root, draft, nextVer
        OPTIONAL MATCH (root)-[oldDraft:LATEST_DRAFT]->()
        DELETE oldDraft
        WITH root, draft, nextVer
        CREATE (root)-[:LATEST_DRAFT]->(draft)

        RETURN root.uid AS rootUid,
               draft.version AS version,
               draft.status AS status
    """, uid=uid, now=now, authorId=author_id)

    record = await result.single()
    if not record:
        logger.warning(f"No FINAL found to create new version for {root_label} {uid}")
        return {}
    return dict(record)


async def retire_version(
    session: AsyncSession,
    root_label: str,
    uid: str,
    author_id: str = "system",
) -> dict:
    """Retire the current FINAL version."""
    now = _now_iso()

    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})-[:LATEST_FINAL]->(final)
        SET final.status = '{RETIRED}',
            final.retiredAt = $now,
            final.updatedAt = $now

        WITH root, final
        MATCH (root)-[hv:HAS_VERSION]->(final)
        SET hv.status = '{RETIRED}',
            hv.endDate = $now

        WITH root, final
        MATCH (root)-[lf:LATEST_FINAL]->(final)
        DELETE lf

        WITH root, final
        OPTIONAL MATCH (root)-[oldRet:LATEST_RETIRED]->()
        DELETE oldRet

        WITH root, final
        CREATE (root)-[:LATEST_RETIRED]->(final)

        RETURN root.uid AS rootUid,
               final.version AS version,
               final.status AS status
    """, uid=uid, now=now, authorId=author_id)

    record = await result.single()
    return dict(record) if record else {}


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

async def get_latest(
    session: AsyncSession,
    root_label: str,
    uid: str,
    status: str = DRAFT,
) -> dict | None:
    """Get the latest Value node properties via shortcut pointer.

    status: 'DRAFT', 'FINAL', or 'RETIRED'
    """
    pointer = f"LATEST_{status}"
    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})-[:{pointer}]->(val)
        RETURN properties(val) AS props, root.uid AS rootUid
    """, uid=uid)
    record = await result.single()
    if not record:
        return None
    props = dict(record["props"])
    props["rootUid"] = record["rootUid"]
    return props


async def get_version(
    session: AsyncSession,
    root_label: str,
    uid: str,
    version: int,
) -> dict | None:
    """Get a specific version's Value node properties."""
    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})
              -[:HAS_VERSION {{version: $version}}]->(val)
        RETURN properties(val) AS props, root.uid AS rootUid
    """, uid=uid, version=version)
    record = await result.single()
    if not record:
        return None
    props = dict(record["props"])
    props["rootUid"] = record["rootUid"]
    return props


async def get_version_history(
    session: AsyncSession,
    root_label: str,
    uid: str,
) -> list[dict]:
    """Get all versions for an entity, ordered by version number."""
    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})-[hv:HAS_VERSION]->(val)
        RETURN val.version AS version,
               hv.status AS status,
               hv.startDate AS startDate,
               hv.endDate AS endDate,
               hv.authorId AS authorId,
               hv.finalizedAt AS finalizedAt,
               val.updatedAt AS updatedAt
        ORDER BY val.version DESC
    """, uid=uid)
    return [dict(r) async for r in result]


async def get_current_status(
    session: AsyncSession,
    root_label: str,
    uid: str,
) -> dict:
    """Get the current state of an entity (what pointers exist)."""
    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})
        OPTIONAL MATCH (root)-[:LATEST_DRAFT]->(draft)
        OPTIONAL MATCH (root)-[:LATEST_FINAL]->(final)
        OPTIONAL MATCH (root)-[:LATEST_RETIRED]->(retired)
        RETURN root.uid AS uid,
               root.createdAt AS createdAt,
               draft.version AS draftVersion,
               final.version AS finalVersion,
               retired.version AS retiredVersion,
               CASE
                   WHEN draft IS NOT NULL THEN 'DRAFT'
                   WHEN final IS NOT NULL THEN 'FINAL'
                   WHEN retired IS NOT NULL THEN 'RETIRED'
                   ELSE 'UNKNOWN'
               END AS currentStatus
    """, uid=uid)
    record = await result.single()
    return dict(record) if record else {}


# ---------------------------------------------------------------------------
# Protocol-level versioning (wraps entire study graph)
# ---------------------------------------------------------------------------

async def create_protocol_version(
    session: AsyncSession,
    protocol_id: str,
    properties: dict,
    author_id: str = "system",
) -> dict:
    """Create a versioned protocol (ProtocolRoot + ProtocolValue).

    This is the top-level entry point for versioned protocols.
    """
    return await create_root_value(
        session, "ProtocolRoot", "ProtocolValue",
        uid=protocol_id, properties=properties, author_id=author_id,
    )


async def finalize_protocol(
    session: AsyncSession,
    protocol_id: str,
    author_id: str = "system",
) -> dict:
    """Finalize current draft protocol → FINAL."""
    return await finalize_version(
        session, "ProtocolRoot", protocol_id, author_id=author_id,
    )


async def create_new_protocol_version(
    session: AsyncSession,
    protocol_id: str,
    author_id: str = "system",
) -> dict:
    """Create new draft from latest final protocol."""
    return await create_new_version(
        session, "ProtocolRoot", "ProtocolValue",
        uid=protocol_id, author_id=author_id,
    )


async def get_protocol_version_history(
    session: AsyncSession,
    protocol_id: str,
) -> list[dict]:
    """Get all versions for a protocol."""
    return await get_version_history(
        session, "ProtocolRoot", protocol_id,
    )


async def get_protocol_status(
    session: AsyncSession,
    protocol_id: str,
) -> dict:
    """Get current protocol versioning state."""
    return await get_current_status(
        session, "ProtocolRoot", protocol_id,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def ensure_protocol_root(
    session: AsyncSession,
    protocol_id: str,
) -> None:
    """Ensure a ProtocolRoot node exists for the given protocol.

    Bridges the gap between Protocol (crud.py) and ProtocolRoot (versioning).
    Creates on first call; no-op on subsequent calls.
    """
    now = _now_iso()
    await session.run("""
        MERGE (root:ProtocolRoot {uid: $uid})
        ON CREATE SET root.createdAt = $now
    """, uid=protocol_id, now=now)


# ---------------------------------------------------------------------------
# Study entity versioning helpers
# ---------------------------------------------------------------------------

async def version_study_entity(
    session: AsyncSession,
    entity_type: str,
    uid: str,
    properties: dict,
    author_id: str = "system",
) -> dict:
    """Create or update a versioned study entity.

    entity_type: 'StudyArm', 'StudyEpoch', 'Encounter', etc.
    Automatically creates Root if not exists, updates DRAFT if exists.
    """
    root_label = f"{entity_type}Root"
    value_label = f"{entity_type}Value"

    # Check if root exists
    result = await session.run(f"""
        MATCH (root:{root_label} {{uid: $uid}})
        OPTIONAL MATCH (root)-[:LATEST_DRAFT]->(draft)
        RETURN root.uid AS uid, draft IS NOT NULL AS hasDraft
    """, uid=uid)
    record = await result.single()

    if record is None:
        # First time: create root + value
        return await create_root_value(
            session, root_label, value_label,
            uid=uid, properties=properties, author_id=author_id,
        )
    elif record["hasDraft"]:
        # Update existing draft
        await update_draft(session, root_label, uid, properties)
        return {"rootUid": uid, "action": "updated_draft"}
    else:
        # Has root but no draft (only FINAL/RETIRED) — create new version
        return await create_new_version(
            session, root_label, value_label,
            uid=uid, author_id=author_id,
        )


# ---------------------------------------------------------------------------
# Bulk versioning for save_design / save_schedule
# ---------------------------------------------------------------------------

async def bulk_version_entities(
    session: AsyncSession,
    entity_type: str,
    protocol_uid: str,
    entities: list[dict],
    id_field: str = "id",
    author_id: str = "system",
) -> int:
    """Version multiple entities of the same type in one pass.

    Creates Root+Value for new entities, updates DRAFT for existing.
    Also creates ownership relationship from ProtocolRoot to entity Root.

    Returns count of entities processed.
    """
    root_label = f"{entity_type}Root"
    value_label = f"{entity_type}Value"
    rel_type = f"HAS_{entity_type.upper()}"
    now = _now_iso()

    if not entities:
        return 0

    # Prepare batch params — flatten nested objects to JSON strings
    # because Neo4j properties only support primitives and arrays of primitives
    items = []
    for ent in entities:
        uid = ent.get(id_field, "")
        if not uid:
            continue
        props = {}
        for k, v in ent.items():
            if v is None:
                continue
            if isinstance(v, dict):
                props[k] = json.dumps(v)
            elif isinstance(v, list) and v and isinstance(v[0], dict):
                props[k] = json.dumps(v)
            else:
                props[k] = v
        items.append({"uid": uid, "props": props})

    if not items:
        return 0

    # Batch MERGE: create Root if not exists, create/update Value
    await session.run(f"""
        UNWIND $items AS item
        MERGE (root:{root_label} {{uid: item.uid}})
        ON CREATE SET root.createdAt = $now

        // Remove old draft if exists
        WITH root, item
        OPTIONAL MATCH (root)-[oldDraftRel:LATEST_DRAFT]->(oldDraft)
        OPTIONAL MATCH (root)-[oldHv:HAS_VERSION]->(oldDraft)
        DELETE oldDraftRel, oldHv, oldDraft

        // Create new value
        WITH root, item
        CREATE (val:{value_label})
        SET val = item.props,
            val.version = COALESCE(
                root.currentVersion, 0
            ) + 1,
            val.status = '{DRAFT}',
            val.createdAt = $now,
            val.updatedAt = $now
        SET root.currentVersion = val.version

        // Create relationships
        CREATE (root)-[:HAS_VERSION {{
            version: val.version,
            status: '{DRAFT}',
            startDate: $now,
            authorId: $authorId
        }}]->(val)
        CREATE (root)-[:LATEST_DRAFT]->(val)

        // Link to protocol
        WITH root
        MATCH (pRoot:ProtocolRoot {{uid: $protocolUid}})
        MERGE (pRoot)-[:{rel_type}]->(root)
    """, items=items, now=now, authorId=author_id, protocolUid=protocol_uid)

    return len(items)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    """ISO 8601 timestamp in UTC."""
    return datetime.now(timezone.utc).isoformat()
