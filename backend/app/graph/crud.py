"""
Neo4j graph CRUD operations.

Each function maps to an equivalent SQLite CRUD operation but creates/reads
proper graph nodes and relationships instead of JSON blobs.

Write functions use transactional batches: delete-old → create-new within
a single transaction so partial failures are rolled back.

Read functions return plain dicts matching the exact JSON shapes the
frontend expects (same contract as the SQLite-based API).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from neo4j import AsyncSession

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------
# Protocol CRUD
# -----------------------------------------------------------------------

async def create_protocol(session: AsyncSession, data: dict) -> dict:
    """Create or merge a Protocol node with scalar properties.

    Uses protocolNumber as the business key. If a Protocol with the same
    protocolNumber already exists, its properties are updated (upsert).
    This avoids ConstraintValidationFailed errors from the unique
    constraint on protocolNumber when a new UUID-based id is generated
    for a retry / re-import.
    """
    now = datetime.now(timezone.utc).isoformat()
    protocol_number = data.get("protocolNumber", "")

    # Check if a protocol with this protocolNumber already exists
    existing = await session.run(
        "MATCH (p:Protocol {protocolNumber: $pn}) RETURN p.id AS existingId",
        pn=protocol_number,
    )
    existing_record = await existing.single()

    # If it already exists, use the existing node's id for the MERGE
    # so we update rather than create a conflicting node
    node_id = existing_record["existingId"] if existing_record else data.get("id", str(uuid4()))

    result = await session.run(
        """
        MERGE (p:Protocol {id: $id})
        ON CREATE SET
            p.protocolNumber = $protocolNumber,
            p.shortTitle = $shortTitle,
            p.fullTitle = $fullTitle,
            p.phase = $phase,
            p.studyType = $studyType,
            p.therapeuticArea = $therapeuticArea,
            p.indication = $indication,
            p.sponsorName = $sponsorName,
            p.status = $status,
            p.version = $version,
            p.sampleSize = $sampleSize,
            p.templateId = $templateId,
            p.narrativeSections = $narrativeSections,
            p.createdAt = $now,
            p.updatedAt = $now
        ON MATCH SET
            p.protocolNumber = $protocolNumber,
            p.shortTitle = $shortTitle,
            p.fullTitle = $fullTitle,
            p.phase = $phase,
            p.studyType = $studyType,
            p.therapeuticArea = $therapeuticArea,
            p.indication = $indication,
            p.sponsorName = $sponsorName,
            p.status = $status,
            p.version = $version,
            p.sampleSize = $sampleSize,
            p.templateId = $templateId,
            p.narrativeSections = $narrativeSections,
            p.updatedAt = $now
        RETURN p
        """,
        id=node_id,
        protocolNumber=protocol_number,
        shortTitle=data.get("shortTitle") or "",
        fullTitle=data.get("fullTitle") or "",
        phase=data.get("phase") or "",
        studyType=data.get("studyType") or "Interventional",
        therapeuticArea=data.get("therapeuticArea") or "",
        indication=data.get("indication") or "",
        sponsorName=data.get("sponsorName") or "",
        status=data.get("status") or "Draft",
        version=data.get("version") or "1.0",
        sampleSize=data.get("sampleSize"),
        templateId=data.get("templateId") or "",
        narrativeSections=json.dumps(data.get("narrativeSections") or {}),
        now=now,
    )
    record = await result.single()
    return dict(record["p"]) if record else {}


async def get_protocol(session: AsyncSession, protocol_id: str) -> dict | None:
    """Read a Protocol node's scalar properties."""
    result = await session.run(
        "MATCH (p:Protocol {id: $id}) RETURN p",
        id=protocol_id,
    )
    record = await result.single()
    if not record:
        return None
    return dict(record["p"])


async def list_protocols(session: AsyncSession) -> list[dict]:
    """List all Protocol nodes ordered by updatedAt desc."""
    result = await session.run(
        "MATCH (p:Protocol) RETURN p ORDER BY p.updatedAt DESC"
    )
    records = await result.data()
    return [dict(r["p"]) for r in records]


async def update_protocol(session: AsyncSession, protocol_id: str, data: dict) -> dict | None:
    """Update scalar fields on a Protocol node."""
    # Build dynamic SET clauses for provided fields
    set_parts = []
    params = {"id": protocol_id, "now": datetime.now(timezone.utc).isoformat()}

    field_map = {
        "protocolNumber": "protocolNumber",
        "shortTitle": "shortTitle",
        "fullTitle": "fullTitle",
        "phase": "phase",
        "studyType": "studyType",
        "therapeuticArea": "therapeuticArea",
        "indication": "indication",
        "sponsorName": "sponsorName",
        "status": "status",
        "version": "version",
        "sampleSize": "sampleSize",
    }
    for camel, prop in field_map.items():
        if camel in data:
            set_parts.append(f"p.{prop} = ${prop}")
            params[prop] = data[camel]

    set_parts.append("p.updatedAt = $now")
    set_clause = ", ".join(set_parts)

    result = await session.run(
        f"MATCH (p:Protocol {{id: $id}}) SET {set_clause} RETURN p",
        **params,
    )
    record = await result.single()
    return dict(record["p"]) if record else None


async def delete_protocol(session: AsyncSession, protocol_id: str) -> bool:
    """Delete a Protocol and ALL its child nodes (cascade)."""
    result = await session.run(
        """
        MATCH (p:Protocol {id: $id})
        OPTIONAL MATCH (p)-[*]->(child)
        DETACH DELETE child, p
        RETURN count(p) AS deleted
        """,
        id=protocol_id,
    )
    record = await result.single()
    return record and record["deleted"] > 0


# -----------------------------------------------------------------------
# Design CRUD — write
# -----------------------------------------------------------------------

async def save_design(session: AsyncSession, protocol_id: str, data: dict):
    """
    Save study design entities to the graph using MERGE/upsert.

    Strategy per entity type:
      1. MERGE each entity by id (create if new, update if exists)
      2. Delete orphans (entities no longer in payload)
      3. Re-link relationships (clear old edges, create new)

    All design entity types have globally unique IDs.
    Child entities (Endpoint) are replaced on their parent (Objective).
    StudyCells are junction nodes — always replaced since they depend on arm/epoch.
    """
    tx = await session.begin_transaction()
    try:
        # --- Study Arms ---
        if "studyArms" in data:
            incoming_ids = [a.get("id", str(uuid4())) for a in data["studyArms"]]
            for arm in data["studyArms"]:
                await tx.run(
                    """
                    MERGE (a:StudyArm {id: $id})
                    ON CREATE SET a.name = $name, a.description = $description,
                                  a.typeCode = $typeCode, a.typeDecode = $typeDecode,
                                  a.order = $order
                    ON MATCH SET  a.name = $name, a.description = $description,
                                  a.typeCode = $typeCode, a.typeDecode = $typeDecode,
                                  a.order = $order
                    WITH a
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_ARM]->(a)
                    """,
                    pid=protocol_id,
                    id=arm.get("id", str(uuid4())),
                    name=arm.get("name", ""),
                    description=arm.get("description", ""),
                    typeCode=_code_val(arm.get("type"), "code"),
                    typeDecode=_code_val(arm.get("type"), "decode"),
                    order=arm.get("order", 0),
                )
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_ARM]->(a:StudyArm)
                WHERE NOT a.id IN $keepIds
                DETACH DELETE a
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Study Epochs ---
        if "studyEpochs" in data:
            epochs = data["studyEpochs"]
            incoming_ids = [e.get("id", str(uuid4())) for e in epochs]
            for epoch in epochs:
                await tx.run(
                    """
                    MERGE (e:StudyEpoch {id: $id})
                    ON CREATE SET e.name = $name, e.description = $description,
                                  e.typeCode = $typeCode, e.typeDecode = $typeDecode,
                                  e.order = $order
                    ON MATCH SET  e.name = $name, e.description = $description,
                                  e.typeCode = $typeCode, e.typeDecode = $typeDecode,
                                  e.order = $order
                    WITH e
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_EPOCH]->(e)
                    """,
                    pid=protocol_id,
                    id=epoch.get("id", str(uuid4())),
                    name=epoch.get("name", ""),
                    description=epoch.get("description", ""),
                    typeCode=_code_val(epoch.get("type"), "code"),
                    typeDecode=_code_val(epoch.get("type"), "decode"),
                    order=epoch.get("order", 0),
                )
            # Clear and rebuild NEXT_EPOCH chain
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_EPOCH]->(e:StudyEpoch)
                       -[r:NEXT_EPOCH]->()
                DELETE r
                """,
                pid=protocol_id,
            )
            for epoch in epochs:
                nid = epoch.get("nextEpochId")
                if nid:
                    await tx.run(
                        """
                        MATCH (e1:StudyEpoch {id: $fromId})
                        MATCH (e2:StudyEpoch {id: $toId})
                        CREATE (e1)-[:NEXT_EPOCH]->(e2)
                        """,
                        fromId=epoch["id"], toId=nid,
                    )
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_EPOCH]->(e:StudyEpoch)
                WHERE NOT e.id IN $keepIds
                DETACH DELETE e
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Study Elements ---
        if "studyElements" in data:
            incoming_ids = [e.get("id", str(uuid4())) for e in data["studyElements"]]
            for elem in data["studyElements"]:
                await tx.run(
                    """
                    MERGE (e:StudyElement {id: $id})
                    ON CREATE SET e.name = $name, e.description = $description,
                                  e.color = $color,
                                  e.transitionStartRule = $transitionStartRule,
                                  e.transitionEndRule = $transitionEndRule
                    ON MATCH SET  e.name = $name, e.description = $description,
                                  e.color = $color,
                                  e.transitionStartRule = $transitionStartRule,
                                  e.transitionEndRule = $transitionEndRule
                    WITH e
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_ELEMENT]->(e)
                    """,
                    pid=protocol_id,
                    id=elem.get("id", str(uuid4())),
                    name=elem.get("name", ""),
                    description=elem.get("description", ""),
                    color=elem.get("color", ""),
                    transitionStartRule=elem.get("transitionStartRule"),
                    transitionEndRule=elem.get("transitionEndRule"),
                )
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_ELEMENT]->(e:StudyElement)
                WHERE NOT e.id IN $keepIds
                DETACH DELETE e
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Study Cells (junction: arm x epoch x elements — always replaced) ---
        if "studyCells" in data:
            # Cells are junction nodes whose identity is arm+epoch — replace all
            await tx.run(
                "MATCH (:Protocol {id: $pid})-[:HAS_CELL]->(c:StudyCell) DETACH DELETE c",
                pid=protocol_id,
            )
            for cell in data["studyCells"]:
                await tx.run(
                    """
                    MATCH (p:Protocol {id: $pid})
                    CREATE (c:StudyCell {id: $id})
                    CREATE (p)-[:HAS_CELL]->(c)
                    WITH c
                    MATCH (arm:StudyArm {id: $armId})
                    CREATE (c)-[:IN_ARM]->(arm)
                    WITH c
                    MATCH (epoch:StudyEpoch {id: $epochId})
                    CREATE (c)-[:IN_EPOCH]->(epoch)
                    """,
                    pid=protocol_id,
                    id=cell.get("id", str(uuid4())),
                    armId=cell.get("armId", ""),
                    epochId=cell.get("epochId", ""),
                )
                for elem_id in cell.get("elementIds", []):
                    await tx.run(
                        """
                        MATCH (c:StudyCell {id: $cellId})
                        MATCH (e:StudyElement {id: $elemId})
                        CREATE (c)-[:CONTAINS_ELEMENT]->(e)
                        """,
                        cellId=cell["id"], elemId=elem_id,
                    )

        # --- Study Markers ---
        if "studyMarkers" in data:
            incoming_ids = [m.get("id", str(uuid4())) for m in data["studyMarkers"]]
            for marker in data["studyMarkers"]:
                await tx.run(
                    """
                    MERGE (m:StudyMarker {id: $id})
                    ON CREATE SET m.type = $type, m.label = $label,
                                  m.ratio = $ratio, m.description = $description
                    ON MATCH SET  m.type = $type, m.label = $label,
                                  m.ratio = $ratio, m.description = $description
                    WITH m
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_MARKER]->(m)
                    """,
                    pid=protocol_id,
                    id=marker.get("id", str(uuid4())),
                    type=marker.get("type", ""),
                    label=marker.get("label", ""),
                    ratio=marker.get("ratio", ""),
                    description=marker.get("description", ""),
                )
                # Re-link AFTER_EPOCH
                await tx.run(
                    "MATCH (m:StudyMarker {id: $id})-[r:AFTER_EPOCH]->() DELETE r",
                    id=marker["id"],
                )
                epoch_id = marker.get("afterEpochId", "")
                if epoch_id:
                    await tx.run(
                        """
                        MATCH (m:StudyMarker {id: $markerId})
                        MATCH (ep:StudyEpoch {id: $epochId})
                        CREATE (m)-[:AFTER_EPOCH]->(ep)
                        """,
                        markerId=marker["id"], epochId=epoch_id,
                    )
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_MARKER]->(m:StudyMarker)
                WHERE NOT m.id IN $keepIds
                DETACH DELETE m
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Study Flow Overrides (always replaced — junction with 3 rels) ---
        if "studyFlowOverrides" in data:
            await tx.run(
                "MATCH (:Protocol {id: $pid})-[:HAS_FLOW_OVERRIDE]->(f:StudyFlowOverride) DETACH DELETE f",
                pid=protocol_id,
            )
            for override in data["studyFlowOverrides"]:
                await tx.run(
                    """
                    MATCH (p:Protocol {id: $pid})
                    CREATE (f:StudyFlowOverride {id: $id, key: $key})
                    CREATE (p)-[:HAS_FLOW_OVERRIDE]->(f)
                    WITH f
                    MATCH (fromArm:StudyArm {id: $fromArmId})
                    CREATE (f)-[:FROM_ARM]->(fromArm)
                    WITH f
                    MATCH (fromEpoch:StudyEpoch {id: $fromEpochId})
                    CREATE (f)-[:FROM_EPOCH]->(fromEpoch)
                    WITH f
                    MATCH (toArm:StudyArm {id: $toArmId})
                    CREATE (f)-[:TO_ARM]->(toArm)
                    """,
                    pid=protocol_id,
                    id=override.get("id", str(uuid4())),
                    key=override.get("key", ""),
                    fromArmId=override.get("fromArmId", ""),
                    fromEpochId=override.get("fromEpochId", ""),
                    toArmId=override.get("toArmId", ""),
                )

        # --- Scalar design fields (stored as Protocol properties) ---
        scalars = {}
        if "interventionModel" in data:
            scalars["interventionModel"] = json.dumps(data["interventionModel"]) if isinstance(data["interventionModel"], dict) else data["interventionModel"]
        if "blindingSchema" in data:
            scalars["blindingSchema"] = json.dumps(data["blindingSchema"]) if isinstance(data["blindingSchema"], dict) else data["blindingSchema"]
        if scalars:
            set_parts = [f"p.{k} = ${k}" for k in scalars]
            set_parts.append("p.updatedAt = $now")
            await tx.run(
                f"MATCH (p:Protocol {{id: $pid}}) SET {', '.join(set_parts)}",
                pid=protocol_id,
                now=datetime.now(timezone.utc).isoformat(),
                **scalars,
            )

        # --- Eligibility Criteria ---
        if "eligibilityCriteria" in data:
            ec = data["eligibilityCriteria"]
            criteria = []
            if isinstance(ec, dict):
                criteria = ec.get("inclusion", []) + ec.get("exclusion", [])
            elif isinstance(ec, list):
                criteria = ec
            incoming_ids = [c.get("id", str(uuid4())) for c in criteria]
            for crit in criteria:
                await tx.run(
                    """
                    MERGE (c:EligibilityCriterion {id: $id})
                    ON CREATE SET c.name = $name, c.text = $text,
                                  c.category = $category, c.order = $order
                    ON MATCH SET  c.name = $name, c.text = $text,
                                  c.category = $category, c.order = $order
                    WITH c
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_CRITERION]->(c)
                    """,
                    pid=protocol_id,
                    id=crit.get("id", str(uuid4())),
                    name=crit.get("name", ""),
                    text=crit.get("text", ""),
                    category=crit.get("category", "inclusion"),
                    order=crit.get("order", 0),
                )
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_CRITERION]->(c:EligibilityCriterion)
                WHERE NOT c.id IN $keepIds
                DETACH DELETE c
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Objectives + Endpoints (MERGE objective, replace endpoints) ---
        if "objectives" in data:
            incoming_ids = [o.get("id", str(uuid4())) for o in data["objectives"]]
            for obj in data["objectives"]:
                level = obj.get("level", {})
                obj_id = obj.get("id", str(uuid4()))
                await tx.run(
                    """
                    MERGE (o:Objective {id: $id})
                    ON CREATE SET o.name = $name, o.description = $description,
                                  o.levelCode = $levelCode, o.levelDecode = $levelDecode
                    ON MATCH SET  o.name = $name, o.description = $description,
                                  o.levelCode = $levelCode, o.levelDecode = $levelDecode
                    WITH o
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_OBJECTIVE]->(o)
                    """,
                    pid=protocol_id,
                    id=obj_id,
                    name=obj.get("name", ""),
                    description=obj.get("description", ""),
                    levelCode=_code_val(level, "code"),
                    levelDecode=_code_val(level, "decode"),
                )
                # Replace endpoints (children)
                await tx.run(
                    """
                    MATCH (o:Objective {id: $objId})-[:HAS_ENDPOINT]->(e:Endpoint)
                    DETACH DELETE e
                    """,
                    objId=obj_id,
                )
                for ep in obj.get("endpoints", []):
                    ep_level = ep.get("level", {})
                    await tx.run(
                        """
                        MATCH (o:Objective {id: $objId})
                        CREATE (e:Endpoint {
                            id: $id, name: $name, description: $description,
                            purpose: $purpose,
                            levelCode: $levelCode, levelDecode: $levelDecode
                        })
                        CREATE (o)-[:HAS_ENDPOINT]->(e)
                        """,
                        objId=obj_id,
                        id=ep.get("id", str(uuid4())),
                        name=ep.get("name", ""),
                        description=ep.get("description", ""),
                        purpose=ep.get("purpose", ""),
                        levelCode=_code_val(ep_level, "code"),
                        levelDecode=_code_val(ep_level, "decode"),
                    )
            # Delete orphaned Objectives + their Endpoints
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_OBJECTIVE]->(o:Objective)
                WHERE NOT o.id IN $keepIds
                OPTIONAL MATCH (o)-[:HAS_ENDPOINT]->(e:Endpoint)
                DETACH DELETE e, o
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        await tx.commit()
    except Exception:
        await tx.rollback()
        raise


# -----------------------------------------------------------------------
# Schedule CRUD — write
# -----------------------------------------------------------------------

async def save_schedule(session: AsyncSession, protocol_id: str, data: dict):
    """
    Save schedule/SOA entities to the graph using MERGE/upsert.

    Strategy per entity type:
      1. MERGE each entity by id (create if new, update if exists)
      2. Delete orphans (entities no longer in payload)
      3. Re-link relationships (clear old edges, create new)

    SoaGroup/ActivityGroup use protocol-scoped MERGE (non-unique IDs).
    All other types use simple MERGE by globally-unique id.
    Child entities (Procedure, Instance, Timing) are replaced on parent.
    """
    tx = await session.begin_transaction()
    try:
        # --- SOA Groups (protocol-scoped MERGE) ---
        if "soaGroups" in data:
            incoming_ids = [g.get("id", "") for g in data["soaGroups"]]
            for grp in data["soaGroups"]:
                await tx.run(
                    """
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_SOA_GROUP]->(g:SoaGroup {id: $id})
                    ON CREATE SET g.name = $name, g.order = $order,
                                  g.colorBg = $colorBg, g.colorText = $colorText,
                                  g.colorBorder = $colorBorder
                    ON MATCH SET  g.name = $name, g.order = $order,
                                  g.colorBg = $colorBg, g.colorText = $colorText,
                                  g.colorBorder = $colorBorder
                    """,
                    pid=protocol_id,
                    id=grp.get("id", ""),
                    name=grp.get("name", ""),
                    order=grp.get("order", 0),
                    colorBg=grp.get("colorBg", ""),
                    colorText=grp.get("colorText", ""),
                    colorBorder=grp.get("colorBorder", ""),
                )
            # Delete orphaned SoaGroups
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_SOA_GROUP]->(g:SoaGroup)
                WHERE NOT g.id IN $keepIds
                DETACH DELETE g
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Activity Groups (protocol-scoped MERGE) ---
        if "activityGroups" in data:
            incoming_ids = [g.get("id", "") for g in data["activityGroups"]]
            for grp in data["activityGroups"]:
                await tx.run(
                    """
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_ACTIVITY_GROUP]->(g:ActivityGroup {id: $id})
                    ON CREATE SET g.name = $name, g.order = $order
                    ON MATCH SET  g.name = $name, g.order = $order
                    """,
                    pid=protocol_id,
                    id=grp.get("id", ""),
                    name=grp.get("name", ""),
                    order=grp.get("order", 0),
                )
                # Re-link BELONGS_TO_SOA (scoped to same protocol)
                soa_id = grp.get("soaGroupId", "")
                if soa_id:
                    await tx.run(
                        """
                        MATCH (p:Protocol {id: $pid})-[:HAS_ACTIVITY_GROUP]->(g:ActivityGroup {id: $agId})
                        OPTIONAL MATCH (g)-[old:BELONGS_TO_SOA]->()
                        DELETE old
                        WITH p, g
                        MATCH (p)-[:HAS_SOA_GROUP]->(sg:SoaGroup {id: $soaId})
                        CREATE (g)-[:BELONGS_TO_SOA]->(sg)
                        """,
                        pid=protocol_id, agId=grp["id"], soaId=soa_id,
                    )
            # Delete orphaned ActivityGroups
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_ACTIVITY_GROUP]->(g:ActivityGroup)
                WHERE NOT g.id IN $keepIds
                DETACH DELETE g
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Encounters (globally unique id — simple MERGE) ---
        if "encounters" in data:
            encounters = data["encounters"]
            incoming_ids = [e.get("id", str(uuid4())) for e in encounters]
            for enc in encounters:
                enc_id = enc.get("id", str(uuid4()))
                await tx.run(
                    """
                    MERGE (e:Encounter {id: $id})
                    ON CREATE SET e.name = $name, e.description = $description,
                                  e.typeCode = $typeCode, e.typeDecode = $typeDecode,
                                  e.environmentalSetting = $environmentalSetting,
                                  e.label = $label, e.order = $order,
                                  e.week = $week, e.studyDay = $studyDay,
                                  e.visitWindow = $visitWindow
                    ON MATCH SET  e.name = $name, e.description = $description,
                                  e.typeCode = $typeCode, e.typeDecode = $typeDecode,
                                  e.environmentalSetting = $environmentalSetting,
                                  e.label = $label, e.order = $order,
                                  e.week = $week, e.studyDay = $studyDay,
                                  e.visitWindow = $visitWindow
                    WITH e
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_ENCOUNTER]->(e)
                    """,
                    pid=protocol_id,
                    id=enc_id,
                    name=enc.get("name", ""),
                    description=enc.get("description", ""),
                    typeCode=_code_val(enc.get("type"), "code"),
                    typeDecode=_code_val(enc.get("type"), "decode"),
                    environmentalSetting=_code_val(enc.get("environmentalSetting"), "code"),
                    label=enc.get("label", ""),
                    order=enc.get("order", 0),
                    week=enc.get("week"),
                    studyDay=enc.get("studyDay"),
                    visitWindow=enc.get("visitWindow", ""),
                )
                # Re-link IN_EPOCH
                await tx.run(
                    "MATCH (e:Encounter {id: $id})-[r:IN_EPOCH]->() DELETE r",
                    id=enc_id,
                )
                epoch_id = enc.get("epochId")
                if epoch_id:
                    await tx.run(
                        """
                        MATCH (e:Encounter {id: $encId})
                        MATCH (ep:StudyEpoch {id: $epochId})
                        CREATE (e)-[:IN_EPOCH]->(ep)
                        """,
                        encId=enc_id, epochId=epoch_id,
                    )
            # Clear old NEXT_ENCOUNTER chain, rebuild
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_ENCOUNTER]->(e:Encounter)
                       -[r:NEXT_ENCOUNTER]->()
                DELETE r
                """,
                pid=protocol_id,
            )
            for enc in encounters:
                nid = enc.get("nextEncounterId")
                if nid:
                    await tx.run(
                        """
                        MATCH (e1:Encounter {id: $fromId})
                        MATCH (e2:Encounter {id: $toId})
                        CREATE (e1)-[:NEXT_ENCOUNTER]->(e2)
                        """,
                        fromId=enc["id"], toId=nid,
                    )
            # Delete orphaned Encounters
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_ENCOUNTER]->(e:Encounter)
                WHERE NOT e.id IN $keepIds
                DETACH DELETE e
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Activities + Procedures (MERGE activity, replace children) ---
        if "activities" in data:
            activities = data["activities"]
            incoming_ids = [a.get("id", str(uuid4())) for a in activities]
            for act in activities:
                act_id = act.get("id", str(uuid4()))
                await tx.run(
                    """
                    MERGE (a:Activity {id: $id})
                    ON CREATE SET a.name = $name, a.description = $description,
                                  a.categoryCode = $categoryCode, a.sdtmDomain = $sdtmDomain,
                                  a.uiCategory = $uiCategory, a.catalogId = $catalogId,
                                  a.source = $source, a.therapeuticArea = $therapeuticArea,
                                  a.nciCode = $nciCode, a.definition = $definition,
                                  a.cdiscCategories = $cdiscCategories,
                                  a.synonyms = $synonyms
                    ON MATCH SET  a.name = $name, a.description = $description,
                                  a.categoryCode = $categoryCode, a.sdtmDomain = $sdtmDomain,
                                  a.uiCategory = $uiCategory, a.catalogId = $catalogId,
                                  a.source = $source, a.therapeuticArea = $therapeuticArea,
                                  a.nciCode = $nciCode, a.definition = $definition,
                                  a.cdiscCategories = $cdiscCategories,
                                  a.synonyms = $synonyms
                    WITH a
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_ACTIVITY]->(a)
                    """,
                    pid=protocol_id,
                    id=act_id,
                    name=act.get("name", ""),
                    description=act.get("description", ""),
                    categoryCode=act.get("categoryCode", ""),
                    sdtmDomain=act.get("sdtmDomain", ""),
                    uiCategory=act.get("uiCategory", ""),
                    catalogId=act.get("catalogId", ""),
                    source=act.get("source", ""),
                    therapeuticArea=act.get("therapeuticArea", ""),
                    nciCode=act.get("nciCode", ""),
                    definition=act.get("definition", ""),
                    cdiscCategories=act.get("cdiscCategories", []),
                    synonyms=act.get("synonyms", []),
                )
                # Re-link IN_SOA_GROUP (scoped to same protocol)
                await tx.run(
                    "MATCH (a:Activity {id: $id})-[r:IN_SOA_GROUP]->() DELETE r",
                    id=act_id,
                )
                soa_id = act.get("soaGroupId")
                if soa_id:
                    await tx.run(
                        """
                        MATCH (p:Protocol {id: $pid})-[:HAS_SOA_GROUP]->(g:SoaGroup {id: $soaId})
                        MATCH (a:Activity {id: $actId})
                        CREATE (a)-[:IN_SOA_GROUP]->(g)
                        """,
                        pid=protocol_id, actId=act_id, soaId=soa_id,
                    )
                # Re-link IN_ACTIVITY_GROUP (scoped to same protocol)
                await tx.run(
                    "MATCH (a:Activity {id: $id})-[r:IN_ACTIVITY_GROUP]->() DELETE r",
                    id=act_id,
                )
                ag_id = act.get("activityGroupId")
                if ag_id:
                    await tx.run(
                        """
                        MATCH (p:Protocol {id: $pid})-[:HAS_ACTIVITY_GROUP]->(g:ActivityGroup {id: $agId})
                        MATCH (a:Activity {id: $actId})
                        CREATE (a)-[:IN_ACTIVITY_GROUP]->(g)
                        """,
                        pid=protocol_id, actId=act_id, agId=ag_id,
                    )
                # Replace procedures (clear old, create new)
                await tx.run(
                    """
                    MATCH (a:Activity {id: $actId})-[:DEFINES_PROCEDURE]->(pr:Procedure)
                    DETACH DELETE pr
                    """,
                    actId=act_id,
                )
                for proc in act.get("definedProcedures", []):
                    await tx.run(
                        """
                        MATCH (a:Activity {id: $actId})
                        CREATE (pr:Procedure {
                            id: $id, name: $name, description: $description,
                            procedureType: $procedureType
                        })
                        CREATE (a)-[:DEFINES_PROCEDURE]->(pr)
                        """,
                        actId=act_id,
                        id=proc.get("id", str(uuid4())),
                        name=proc.get("name", ""),
                        description=proc.get("description", ""),
                        procedureType=_code_val(proc.get("procedureType"), "code"),
                    )
            # Clear old NEXT_ACTIVITY chain, rebuild
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_ACTIVITY]->(a:Activity)
                       -[r:NEXT_ACTIVITY]->()
                DELETE r
                """,
                pid=protocol_id,
            )
            for act in activities:
                nid = act.get("nextActivityId")
                if nid:
                    await tx.run(
                        """
                        MATCH (a1:Activity {id: $fromId})
                        MATCH (a2:Activity {id: $toId})
                        CREATE (a1)-[:NEXT_ACTIVITY]->(a2)
                        """,
                        fromId=act["id"], toId=nid,
                    )
            # Delete orphaned Activities + their Procedures
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_ACTIVITY]->(a:Activity)
                WHERE NOT a.id IN $keepIds
                OPTIONAL MATCH (a)-[:DEFINES_PROCEDURE]->(pr:Procedure)
                DETACH DELETE pr, a
                """,
                pid=protocol_id, keepIds=incoming_ids,
            )

        # --- Schedule Timelines (MERGE timeline, replace children) ---
        if "scheduleTimelines" in data:
            incoming_tl_ids = []
            for tl in data["scheduleTimelines"]:
                tl_id = tl.get("id") or str(uuid4())
                incoming_tl_ids.append(tl_id)

                # MERGE the timeline node
                await tx.run(
                    """
                    MERGE (tl:ScheduleTimeline {id: $id})
                    ON CREATE SET tl.name = $name, tl.description = $description,
                                  tl.mainTimeline = $mainTimeline,
                                  tl.entryCondition = $entryCondition
                    ON MATCH SET  tl.name = $name, tl.description = $description,
                                  tl.mainTimeline = $mainTimeline,
                                  tl.entryCondition = $entryCondition
                    WITH tl
                    MATCH (p:Protocol {id: $pid})
                    MERGE (p)-[:HAS_TIMELINE]->(tl)
                    """,
                    pid=protocol_id,
                    id=tl_id,
                    name=tl.get("name", "Main Timeline"),
                    description=tl.get("description", ""),
                    mainTimeline=tl.get("mainTimeline", True),
                    entryCondition=tl.get("entryCondition", ""),
                )

                # Replace children: delete old instances + timings, recreate
                await tx.run(
                    """
                    MATCH (tl:ScheduleTimeline {id: $tlId})-[:HAS_INSTANCE]->(i:ScheduledActivityInstance)
                    DETACH DELETE i
                    """,
                    tlId=tl_id,
                )
                await tx.run(
                    """
                    MATCH (tl:ScheduleTimeline {id: $tlId})-[:HAS_TIMING]->(t:Timing)
                    DETACH DELETE t
                    """,
                    tlId=tl_id,
                )

                # Instances (SOA matrix junctions)
                for inst in tl.get("instances", []):
                    inst_id = inst.get("id", str(uuid4()))
                    await tx.run(
                        """
                        MATCH (tl:ScheduleTimeline {id: $tlId})
                        CREATE (i:ScheduledActivityInstance {
                            id: $id,
                            defaultConditionId: $defaultConditionId
                        })
                        CREATE (tl)-[:HAS_INSTANCE]->(i)
                        """,
                        tlId=tl_id,
                        id=inst_id,
                        defaultConditionId=inst.get("defaultConditionId", "mandatory"),
                    )
                    # AT_ENCOUNTER
                    enc_id = inst.get("encounterId")
                    if enc_id:
                        await tx.run(
                            """
                            MATCH (i:ScheduledActivityInstance {id: $instId})
                            MATCH (e:Encounter {id: $encId})
                            CREATE (i)-[:AT_ENCOUNTER]->(e)
                            """,
                            instId=inst_id, encId=enc_id,
                        )
                    # FOR_ACTIVITY (N:M)
                    for act_id in inst.get("activityIds", []):
                        await tx.run(
                            """
                            MATCH (i:ScheduledActivityInstance {id: $instId})
                            MATCH (a:Activity {id: $actId})
                            CREATE (i)-[:FOR_ACTIVITY]->(a)
                            """,
                            instId=inst_id, actId=act_id,
                        )
                    # IN_EPOCH (optional)
                    epoch_id = inst.get("epochId")
                    if epoch_id:
                        await tx.run(
                            """
                            MATCH (i:ScheduledActivityInstance {id: $instId})
                            MATCH (ep:StudyEpoch {id: $epochId})
                            CREATE (i)-[:IN_EPOCH]->(ep)
                            """,
                            instId=inst_id, epochId=epoch_id,
                        )

                # Timings
                for timing in tl.get("timings", []):
                    timing_id = timing.get("id", str(uuid4()))
                    await tx.run(
                        """
                        MATCH (tl:ScheduleTimeline {id: $tlId})
                        CREATE (t:Timing {
                            id: $id, typeCode: $typeCode,
                            description: $description,
                            value: $value, valueLabel: $valueLabel,
                            windowLower: $windowLower,
                            windowUpper: $windowUpper,
                            windowLabel: $windowLabel
                        })
                        CREATE (tl)-[:HAS_TIMING]->(t)
                        """,
                        tlId=tl_id,
                        id=timing_id,
                        typeCode=_code_val(timing.get("type"), "code"),
                        description=timing.get("description", ""),
                        value=timing.get("value", ""),
                        valueLabel=timing.get("valueLabel", ""),
                        windowLower=timing.get("windowLower", ""),
                        windowUpper=timing.get("windowUpper", ""),
                        windowLabel=timing.get("windowLabel", ""),
                    )
                    # RELATIVE_FROM / RELATIVE_TO
                    from_id = timing.get("relativeFromScheduledInstanceId")
                    if from_id:
                        await tx.run(
                            """
                            MATCH (t:Timing {id: $tId})
                            MATCH (i:ScheduledActivityInstance {id: $instId})
                            CREATE (t)-[:RELATIVE_FROM]->(i)
                            """,
                            tId=timing_id, instId=from_id,
                        )
                    to_id = timing.get("relativeToScheduledInstanceId")
                    if to_id:
                        await tx.run(
                            """
                            MATCH (t:Timing {id: $tId})
                            MATCH (i:ScheduledActivityInstance {id: $instId})
                            CREATE (t)-[:RELATIVE_TO]->(i)
                            """,
                            tId=timing_id, instId=to_id,
                        )

            # Delete orphaned Timelines + their children
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})-[:HAS_TIMELINE]->(tl:ScheduleTimeline)
                WHERE NOT tl.id IN $keepIds
                OPTIONAL MATCH (tl)-[:HAS_INSTANCE]->(i:ScheduledActivityInstance)
                OPTIONAL MATCH (tl)-[:HAS_TIMING]->(t:Timing)
                DETACH DELETE t, i, tl
                """,
                pid=protocol_id, keepIds=incoming_tl_ids,
            )

        # Update timestamp
        await tx.run(
            "MATCH (p:Protocol {id: $pid}) SET p.updatedAt = $now",
            pid=protocol_id, now=datetime.now(timezone.utc).isoformat(),
        )
        await tx.commit()
    except Exception:
        await tx.rollback()
        raise


# -----------------------------------------------------------------------
# Reference Trials CRUD
# -----------------------------------------------------------------------

async def save_reference_trials(session: AsyncSession, protocol_id: str, trials: list[dict]):
    """Replace all reference trials for a protocol."""
    tx = await session.begin_transaction()
    try:
        await tx.run(
            "MATCH (:Protocol {id: $pid})-[:REFERENCES_TRIAL]->(r:ReferenceTrial) DETACH DELETE r",
            pid=protocol_id,
        )
        for trial in trials:
            await tx.run(
                """
                MATCH (p:Protocol {id: $pid})
                CREATE (r:ReferenceTrial {
                    nctId: $nctId, briefTitle: $briefTitle,
                    officialTitle: $officialTitle,
                    conditions: $conditions, phase: $phase,
                    sponsor: $sponsor, enrollment: $enrollment,
                    armsJson: $armsJson, parsedAt: $parsedAt
                })
                CREATE (p)-[:REFERENCES_TRIAL]->(r)
                """,
                pid=protocol_id,
                nctId=trial.get("nctId") or "",
                briefTitle=trial.get("briefTitle") or "",
                officialTitle=trial.get("officialTitle") or "",
                conditions=trial.get("conditions") or [],
                phase=trial.get("phase") or "",
                sponsor=trial.get("sponsor") or "",
                enrollment=trial.get("enrollment") or 0,
                armsJson=json.dumps(trial.get("arms") or []),
                parsedAt=trial.get("parsedAt") or "",
            )
        await tx.commit()
    except Exception:
        await tx.rollback()
        raise


# -----------------------------------------------------------------------
# Design CRUD — read
# -----------------------------------------------------------------------

async def get_design(session: AsyncSession, protocol_id: str) -> dict | None:
    """
    Read all design entities and reconstruct the JSON dict
    matching the current API contract.
    """
    # Check protocol exists
    proto = await get_protocol(session, protocol_id)
    if not proto:
        return None

    design = {}

    # Arms
    result = await session.run(
        "MATCH (:Protocol {id: $pid})-[:HAS_ARM]->(a:StudyArm) RETURN a ORDER BY a.order",
        pid=protocol_id,
    )
    design["studyArms"] = [_arm_to_dict(r["a"]) for r in await result.data()]

    # Epochs
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_EPOCH]->(e:StudyEpoch)
        OPTIONAL MATCH (e)-[:NEXT_EPOCH]->(next:StudyEpoch)
        RETURN e, next.id AS nextEpochId ORDER BY e.order
        """,
        pid=protocol_id,
    )
    design["studyEpochs"] = [_epoch_to_dict(r["e"], r["nextEpochId"]) for r in await result.data()]

    # Elements
    result = await session.run(
        "MATCH (:Protocol {id: $pid})-[:HAS_ELEMENT]->(e:StudyElement) RETURN e",
        pid=protocol_id,
    )
    design["studyElements"] = [_element_to_dict(r["e"]) for r in await result.data()]

    # Cells
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_CELL]->(c:StudyCell)
        MATCH (c)-[:IN_ARM]->(arm:StudyArm)
        MATCH (c)-[:IN_EPOCH]->(epoch:StudyEpoch)
        OPTIONAL MATCH (c)-[:CONTAINS_ELEMENT]->(elem:StudyElement)
        RETURN c.id AS id, arm.id AS armId, epoch.id AS epochId,
               collect(elem.id) AS elementIds
        """,
        pid=protocol_id,
    )
    design["studyCells"] = [
        {"id": r["id"], "armId": r["armId"], "epochId": r["epochId"],
         "elementIds": [e for e in r["elementIds"] if e]}
        for r in await result.data()
    ]

    # Markers
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_MARKER]->(m:StudyMarker)
        OPTIONAL MATCH (m)-[:AFTER_EPOCH]->(epoch:StudyEpoch)
        RETURN m, epoch.id AS afterEpochId
        """,
        pid=protocol_id,
    )
    design["studyMarkers"] = [
        {**_node_props(r["m"]), "afterEpochId": r["afterEpochId"]}
        for r in await result.data()
    ]

    # Flow Overrides
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_FLOW_OVERRIDE]->(f:StudyFlowOverride)
        MATCH (f)-[:FROM_ARM]->(fromArm:StudyArm)
        MATCH (f)-[:FROM_EPOCH]->(fromEpoch:StudyEpoch)
        MATCH (f)-[:TO_ARM]->(toArm:StudyArm)
        RETURN f.id AS id, f.key AS key,
               fromArm.id AS fromArmId, fromEpoch.id AS fromEpochId,
               toArm.id AS toArmId
        """,
        pid=protocol_id,
    )
    design["studyFlowOverrides"] = [dict(r) for r in await result.data()]

    # Scalars
    design["interventionModel"] = _parse_json_or_val(proto.get("interventionModel"))
    design["blindingSchema"] = _parse_json_or_val(proto.get("blindingSchema"))

    # Eligibility Criteria
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_CRITERION]->(c:EligibilityCriterion)
        RETURN c ORDER BY c.order
        """,
        pid=protocol_id,
    )
    criteria = [_node_props(r["c"]) for r in await result.data()]
    design["eligibilityCriteria"] = {
        "inclusion": [c for c in criteria if c.get("category") == "inclusion"],
        "exclusion": [c for c in criteria if c.get("category") == "exclusion"],
    }

    # Objectives + Endpoints
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_OBJECTIVE]->(o:Objective)
        OPTIONAL MATCH (o)-[:HAS_ENDPOINT]->(e:Endpoint)
        RETURN o, collect(e) AS endpoints
        """,
        pid=protocol_id,
    )
    design["objectives"] = [
        _objective_to_dict(r["o"], r["endpoints"])
        for r in await result.data()
    ]

    return design


# -----------------------------------------------------------------------
# Schedule CRUD — read
# -----------------------------------------------------------------------

async def get_schedule(session: AsyncSession, protocol_id: str) -> dict | None:
    """
    Read all schedule entities and reconstruct the JSON dict
    matching the current API contract.
    """
    proto = await get_protocol(session, protocol_id)
    if not proto:
        return None

    schedule = {}

    # SOA Groups
    result = await session.run(
        "MATCH (:Protocol {id: $pid})-[:HAS_SOA_GROUP]->(g:SoaGroup) RETURN g ORDER BY g.order",
        pid=protocol_id,
    )
    schedule["soaGroups"] = [_node_props(r["g"]) for r in await result.data()]

    # Activity Groups
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_ACTIVITY_GROUP]->(g:ActivityGroup)
        OPTIONAL MATCH (g)-[:BELONGS_TO_SOA]->(sg:SoaGroup)
        RETURN g, sg.id AS soaGroupId ORDER BY g.order
        """,
        pid=protocol_id,
    )
    schedule["activityGroups"] = [
        {**_node_props(r["g"]), "soaGroupId": r["soaGroupId"]}
        for r in await result.data()
    ]

    # Encounters
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_ENCOUNTER]->(e:Encounter)
        OPTIONAL MATCH (e)-[:IN_EPOCH]->(epoch:StudyEpoch)
        OPTIONAL MATCH (e)-[:NEXT_ENCOUNTER]->(next:Encounter)
        RETURN e, epoch.id AS epochId, next.id AS nextEncounterId
        ORDER BY e.order
        """,
        pid=protocol_id,
    )
    schedule["encounters"] = [
        _encounter_to_dict(r["e"], r["epochId"], r["nextEncounterId"])
        for r in await result.data()
    ]

    # Activities + Procedures
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:HAS_ACTIVITY]->(a:Activity)
        OPTIONAL MATCH (a)-[:DEFINES_PROCEDURE]->(pr:Procedure)
        OPTIONAL MATCH (a)-[:IN_SOA_GROUP]->(sg:SoaGroup)
        OPTIONAL MATCH (a)-[:IN_ACTIVITY_GROUP]->(ag:ActivityGroup)
        OPTIONAL MATCH (a)-[:NEXT_ACTIVITY]->(next:Activity)
        RETURN a, collect(DISTINCT pr) AS procedures,
               sg.id AS soaGroupId, ag.id AS activityGroupId,
               next.id AS nextActivityId
        """,
        pid=protocol_id,
    )
    schedule["activities"] = [
        _activity_to_dict(r["a"], r["procedures"], r["soaGroupId"],
                          r["activityGroupId"], r["nextActivityId"])
        for r in await result.data()
    ]

    # Timelines + Instances + Timings
    result = await session.run(
        "MATCH (:Protocol {id: $pid})-[:HAS_TIMELINE]->(tl:ScheduleTimeline) RETURN tl",
        pid=protocol_id,
    )
    timelines = []
    for r in await result.data():
        tl_node = r["tl"]
        tl_id = tl_node["id"]

        # Instances for this timeline
        inst_result = await session.run(
            """
            MATCH (tl:ScheduleTimeline {id: $tlId})-[:HAS_INSTANCE]->(i:ScheduledActivityInstance)
            OPTIONAL MATCH (i)-[:AT_ENCOUNTER]->(enc:Encounter)
            OPTIONAL MATCH (i)-[:FOR_ACTIVITY]->(act:Activity)
            OPTIONAL MATCH (i)-[:IN_EPOCH]->(epoch:StudyEpoch)
            RETURN i, enc.id AS encounterId,
                   collect(DISTINCT act.id) AS activityIds,
                   epoch.id AS epochId
            """,
            tlId=tl_id,
        )
        instances = [
            {
                "id": ir["i"]["id"],
                "activityIds": [a for a in ir["activityIds"] if a],
                "encounterId": ir["encounterId"],
                "epochId": ir["epochId"],
                "defaultConditionId": ir["i"].get("defaultConditionId", "mandatory"),
            }
            for ir in await inst_result.data()
        ]

        # Timings for this timeline
        timing_result = await session.run(
            """
            MATCH (tl:ScheduleTimeline {id: $tlId})-[:HAS_TIMING]->(t:Timing)
            OPTIONAL MATCH (t)-[:RELATIVE_FROM]->(fromInst:ScheduledActivityInstance)
            OPTIONAL MATCH (t)-[:RELATIVE_TO]->(toInst:ScheduledActivityInstance)
            RETURN t, fromInst.id AS relativeFromScheduledInstanceId,
                   toInst.id AS relativeToScheduledInstanceId
            """,
            tlId=tl_id,
        )
        timings = [
            _timing_to_dict(tr["t"], tr["relativeFromScheduledInstanceId"],
                            tr["relativeToScheduledInstanceId"])
            for tr in await timing_result.data()
        ]

        timelines.append({
            "id": tl_id,
            "name": tl_node.get("name", ""),
            "description": tl_node.get("description", ""),
            "mainTimeline": tl_node.get("mainTimeline", True),
            "entryCondition": tl_node.get("entryCondition", ""),
            "instances": instances,
            "timings": timings,
        })

    schedule["scheduleTimelines"] = timelines
    return schedule


# -----------------------------------------------------------------------
# Reference Trials — read
# -----------------------------------------------------------------------

async def get_reference_trials(session: AsyncSession, protocol_id: str) -> list[dict]:
    """Read reference trials for a protocol."""
    result = await session.run(
        """
        MATCH (:Protocol {id: $pid})-[:REFERENCES_TRIAL]->(r:ReferenceTrial)
        RETURN r
        """,
        pid=protocol_id,
    )
    trials = []
    for r in await result.data():
        node = dict(r["r"])
        # Reconstruct arms from JSON
        arms_json = node.pop("armsJson", "[]")
        try:
            node["arms"] = json.loads(arms_json)
        except (json.JSONDecodeError, TypeError):
            node["arms"] = []
        trials.append(node)
    return trials


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _code_val(code_obj: Any, field: str) -> str | None:
    """Extract a field from a Code dict or return None."""
    if isinstance(code_obj, dict):
        return code_obj.get(field)
    return None


def _node_props(node) -> dict:
    """Convert a Neo4j Node to a plain dict."""
    return dict(node) if node else {}


def _parse_json_or_val(val: Any) -> Any:
    """If val is a JSON string, parse it; otherwise return as-is."""
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            pass
    return val


def _arm_to_dict(node) -> dict:
    """Convert a StudyArm node back to frontend-expected dict."""
    d = _node_props(node)
    # Reconstruct type Code object from flat fields
    type_code = d.pop("typeCode", None)
    type_decode = d.pop("typeDecode", None)
    if type_code or type_decode:
        d["type"] = {"code": type_code, "decode": type_decode}
    return d


def _epoch_to_dict(node, next_epoch_id: str | None) -> dict:
    """Convert a StudyEpoch node back to frontend-expected dict."""
    d = _arm_to_dict(node)  # same type flattening logic
    if next_epoch_id:
        d["nextEpochId"] = next_epoch_id
    # Derive previousEpochId from reverse
    # (the frontend primarily uses order, not linked list pointers)
    return d


def _element_to_dict(node) -> dict:
    """Convert a StudyElement node to dict."""
    return _node_props(node)


def _encounter_to_dict(node, epoch_id: str | None, next_id: str | None) -> dict:
    """Convert an Encounter node to frontend-expected dict."""
    d = _node_props(node)
    type_code = d.pop("typeCode", None)
    type_decode = d.pop("typeDecode", None)
    if type_code or type_decode:
        d["type"] = {"code": type_code, "decode": type_decode}
    env = d.pop("environmentalSetting", None)
    if env:
        d["environmentalSetting"] = {"code": env}
    if epoch_id:
        d["epochId"] = epoch_id
    if next_id:
        d["nextEncounterId"] = next_id
    return d


def _activity_to_dict(
    node, procedures: list, soa_group_id: str | None,
    activity_group_id: str | None, next_id: str | None
) -> dict:
    """Convert an Activity node + its relationships to frontend-expected dict."""
    d = _node_props(node)
    d["definedProcedures"] = [_procedure_to_dict(p) for p in procedures if p]
    if soa_group_id:
        d["soaGroupId"] = soa_group_id
    if activity_group_id:
        d["activityGroupId"] = activity_group_id
    if next_id:
        d["nextActivityId"] = next_id
    return d


def _procedure_to_dict(node) -> dict:
    """Convert a Procedure node to dict."""
    d = _node_props(node)
    pt = d.pop("procedureType", None)
    if pt:
        d["procedureType"] = {"code": pt}
    return d


def _objective_to_dict(node, endpoint_nodes: list) -> dict:
    """Convert an Objective node + endpoints to frontend-expected dict."""
    d = _node_props(node)
    level_code = d.pop("levelCode", None)
    level_decode = d.pop("levelDecode", None)
    if level_code or level_decode:
        d["level"] = {"code": level_code, "decode": level_decode}
    endpoints = []
    for ep in endpoint_nodes:
        if ep is None:
            continue
        ed = _node_props(ep)
        ep_code = ed.pop("levelCode", None)
        ep_decode = ed.pop("levelDecode", None)
        if ep_code or ep_decode:
            ed["level"] = {"code": ep_code, "decode": ep_decode}
        endpoints.append(ed)
    d["endpoints"] = endpoints
    return d


def _timing_to_dict(node, from_inst_id: str | None, to_inst_id: str | None) -> dict:
    """Convert a Timing node to frontend-expected dict."""
    d = _node_props(node)
    type_code = d.pop("typeCode", None)
    if type_code:
        d["type"] = {"code": type_code}
    if from_inst_id:
        d["relativeFromScheduledInstanceId"] = from_inst_id
    if to_inst_id:
        d["relativeToScheduledInstanceId"] = to_inst_id
    return d
