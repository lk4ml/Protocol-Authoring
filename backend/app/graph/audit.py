"""
Audit trail for Neo4j graph operations.

Records every study change as a StudyAction node with:
- Action type (CREATE, UPDATE, DELETE, FINALIZE, NEW_VERSION, ROLLBACK)
- Timestamp, author, entity type, entity UID
- BEFORE/AFTER relationships to Value node snapshots
- Linked to Protocol via HAS_ACTION relationship

Follows the OpenStudyBuilder StudyAction pattern for regulatory compliance.
"""

import logging
import uuid
from datetime import datetime, timezone

from neo4j import AsyncSession

logger = logging.getLogger(__name__)

# Action types
CREATE = "CREATE"
UPDATE = "UPDATE"
DELETE = "DELETE"
FINALIZE = "FINALIZE"
NEW_VERSION = "NEW_VERSION"
ROLLBACK = "ROLLBACK"
RETIRE = "RETIRE"


async def record_action(
    session: AsyncSession,
    protocol_id: str,
    action_type: str,
    entity_type: str,
    entity_uid: str,
    author_id: str = "system",
    description: str = "",
    before_snapshot: dict = None,
    after_snapshot: dict = None,
) -> str:
    """Record a study action in the audit trail.

    Args:
        protocol_id: Protocol this action belongs to
        action_type: CREATE, UPDATE, DELETE, FINALIZE, NEW_VERSION, ROLLBACK
        entity_type: Node label (e.g. StudyArm, Encounter)
        entity_uid: UID of the entity that was changed
        author_id: Who performed the action
        description: Human-readable description
        before_snapshot: Properties before the change (for UPDATE/DELETE)
        after_snapshot: Properties after the change (for CREATE/UPDATE)

    Returns:
        Action ID
    """
    action_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Create the action node
    await session.run("""
        CREATE (a:StudyAction {
            id: $actionId,
            actionType: $actionType,
            entityType: $entityType,
            entityUid: $entityUid,
            authorId: $authorId,
            description: $description,
            timestamp: $timestamp
        })
        WITH a
        MATCH (p:Protocol {id: $protocolId})
        MERGE (p)-[:HAS_ACTION]->(a)
    """, actionId=action_id, actionType=action_type,
         entityType=entity_type, entityUid=entity_uid,
         authorId=author_id, description=description,
         timestamp=now, protocolId=protocol_id)

    # Link to entity Root if it exists
    root_label = f"{entity_type}Root"
    await session.run(f"""
        MATCH (a:StudyAction {{id: $actionId}})
        OPTIONAL MATCH (root:{root_label} {{uid: $entityUid}})
        FOREACH (_ IN CASE WHEN root IS NOT NULL THEN [1] ELSE [] END |
            MERGE (a)-[:ON_ENTITY]->(root)
        )
    """, actionId=action_id, entityUid=entity_uid)

    # Store before/after snapshots as properties on the action node
    if before_snapshot:
        import json
        await session.run("""
            MATCH (a:StudyAction {id: $actionId})
            SET a.beforeSnapshot = $snapshot
        """, actionId=action_id,
             snapshot=json.dumps(before_snapshot, default=str))

    if after_snapshot:
        import json
        await session.run("""
            MATCH (a:StudyAction {id: $actionId})
            SET a.afterSnapshot = $snapshot
        """, actionId=action_id,
             snapshot=json.dumps(after_snapshot, default=str))

    return action_id


async def record_bulk_action(
    session: AsyncSession,
    protocol_id: str,
    action_type: str,
    entity_type: str,
    entity_count: int,
    author_id: str = "system",
    description: str = "",
) -> str:
    """Record a bulk action (e.g. 'saved 5 StudyArms').

    Used for save_design/save_schedule which touch multiple entities.
    """
    action_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    desc = description or f"{action_type} {entity_count} {entity_type}(s)"

    await session.run("""
        CREATE (a:StudyAction {
            id: $actionId,
            actionType: $actionType,
            entityType: $entityType,
            entityUid: 'bulk',
            entityCount: $entityCount,
            authorId: $authorId,
            description: $description,
            timestamp: $timestamp
        })
        WITH a
        MATCH (p:Protocol {id: $protocolId})
        MERGE (p)-[:HAS_ACTION]->(a)
    """, actionId=action_id, actionType=action_type,
         entityType=entity_type, entityCount=entity_count,
         authorId=author_id, description=desc,
         timestamp=now, protocolId=protocol_id)

    return action_id


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

async def get_audit_trail(
    session: AsyncSession,
    protocol_id: str,
    limit: int = 50,
    offset: int = 0,
    entity_type: str = None,
    action_type: str = None,
) -> list[dict]:
    """Get audit trail for a protocol, newest first."""
    params = {"protocolId": protocol_id, "limit": limit, "offset": offset}
    where_parts = []

    if entity_type:
        where_parts.append("a.entityType = $entityType")
        params["entityType"] = entity_type
    if action_type:
        where_parts.append("a.actionType = $actionType")
        params["actionType"] = action_type

    where = "AND " + " AND ".join(where_parts) if where_parts else ""

    result = await session.run(f"""
        MATCH (p:Protocol {{id: $protocolId}})-[:HAS_ACTION]->(a:StudyAction)
        WHERE true {where}
        RETURN a.id AS id,
               a.actionType AS actionType,
               a.entityType AS entityType,
               a.entityUid AS entityUid,
               a.entityCount AS entityCount,
               a.authorId AS authorId,
               a.description AS description,
               a.timestamp AS timestamp,
               a.beforeSnapshot AS beforeSnapshot,
               a.afterSnapshot AS afterSnapshot
        ORDER BY a.timestamp DESC
        SKIP $offset LIMIT $limit
    """, **params)

    actions = []
    async for r in result:
        d = dict(r)
        # Parse JSON snapshots
        for key in ("beforeSnapshot", "afterSnapshot"):
            if d.get(key):
                try:
                    import json
                    d[key] = json.loads(d[key])
                except (json.JSONDecodeError, TypeError):
                    pass
        actions.append(d)
    return actions


async def get_entity_history(
    session: AsyncSession,
    protocol_id: str,
    entity_uid: str,
) -> list[dict]:
    """Get all actions for a specific entity."""
    result = await session.run("""
        MATCH (p:Protocol {id: $protocolId})-[:HAS_ACTION]->(a:StudyAction)
        WHERE a.entityUid = $entityUid
        RETURN a.id AS id,
               a.actionType AS actionType,
               a.entityType AS entityType,
               a.authorId AS authorId,
               a.description AS description,
               a.timestamp AS timestamp,
               a.beforeSnapshot AS beforeSnapshot,
               a.afterSnapshot AS afterSnapshot
        ORDER BY a.timestamp DESC
    """, protocolId=protocol_id, entityUid=entity_uid)

    actions = []
    async for r in result:
        d = dict(r)
        for key in ("beforeSnapshot", "afterSnapshot"):
            if d.get(key):
                try:
                    import json
                    d[key] = json.loads(d[key])
                except (json.JSONDecodeError, TypeError):
                    pass
        actions.append(d)
    return actions


async def get_audit_summary(
    session: AsyncSession,
    protocol_id: str,
) -> dict:
    """Get summary statistics for a protocol's audit trail."""
    result = await session.run("""
        MATCH (p:Protocol {id: $protocolId})-[:HAS_ACTION]->(a:StudyAction)
        RETURN a.actionType AS actionType,
               a.entityType AS entityType,
               count(a) AS count
        ORDER BY count DESC
    """, protocolId=protocol_id)

    by_action = {}
    by_entity = {}
    total = 0
    async for r in result:
        action = r["actionType"]
        entity = r["entityType"]
        count = r["count"]
        total += count
        by_action[action] = by_action.get(action, 0) + count
        by_entity[entity] = by_entity.get(entity, 0) + count

    return {
        "totalActions": total,
        "byActionType": by_action,
        "byEntityType": by_entity,
    }
