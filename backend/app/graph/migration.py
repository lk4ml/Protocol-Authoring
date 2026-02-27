"""
One-time migration script: SQLite → Neo4j.

Reads all protocols from the SQLite database and writes them to Neo4j
as proper graph nodes and relationships.

Usage:
    cd backend
    python -m app.graph.migration

Idempotent: Uses MERGE for the Protocol node so it's safe to re-run.
Child nodes are replaced (delete + create) per protocol.
"""

import asyncio
import json
import logging
import sys
import os

# Ensure the app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def migrate():
    from app.database import SessionLocal
    from app.db.tables import ProtocolDB
    from app.graph import get_driver, close_driver
    from app.graph.schema import ensure_constraints
    from app.graph import crud as graph_crud

    # 1. Apply constraints/indexes
    driver = await get_driver()
    logger.info("Applying Neo4j constraints and indexes...")
    await ensure_constraints(driver)

    # 2. Read all protocols from SQLite
    db = SessionLocal()
    protocols = db.query(ProtocolDB).all()
    logger.info(f"Found {len(protocols)} protocols in SQLite")

    # 3. Migrate each protocol
    for idx, protocol in enumerate(protocols, 1):
        logger.info(f"[{idx}/{len(protocols)}] Migrating: {protocol.protocol_number} (id={protocol.id})")

        async with driver.session() as session:
            # Create/update Protocol node
            await graph_crud.create_protocol(session, {
                "id": protocol.id,
                "protocolNumber": protocol.protocol_number,
                "shortTitle": protocol.short_title or "",
                "fullTitle": protocol.full_title or "",
                "phase": protocol.phase or "",
                "studyType": protocol.study_type or "",
                "therapeuticArea": protocol.therapeutic_area or "",
                "indication": protocol.indication or "",
                "sponsorName": protocol.sponsor_name or "",
                "status": protocol.status or "Draft",
                "version": protocol.version or "1.0",
                "sampleSize": protocol.sample_size,
                "templateId": protocol.template_id,
                "narrativeSections": protocol.narrative_sections or {},
            })

            # Save design entities
            sdd = protocol.study_design_data or {}
            if sdd:
                logger.info(f"  Writing design data ({len(sdd.get('studyArms', []))} arms, "
                            f"{len(sdd.get('studyEpochs', []))} epochs, "
                            f"{len(sdd.get('studyCells', []))} cells, "
                            f"{len(sdd.get('activities', []))} activities)")
                await graph_crud.save_design(session, protocol.id, sdd)
                await graph_crud.save_schedule(session, protocol.id, sdd)

            # Save reference trials
            refs = protocol.reference_trials or []
            if refs:
                logger.info(f"  Writing {len(refs)} reference trials")
                await graph_crud.save_reference_trials(session, protocol.id, refs)

    db.close()
    await close_driver()
    logger.info("Migration complete!")


async def verify():
    """Quick verification: count nodes and check relationships."""
    from app.graph import get_driver, close_driver

    driver = await get_driver()
    async with driver.session() as session:
        # Count key node types
        counts = {}
        for label in ["Protocol", "StudyArm", "StudyEpoch", "StudyCell",
                       "Encounter", "Activity", "ScheduledActivityInstance",
                       "SoaGroup", "ActivityGroup", "Objective", "EligibilityCriterion",
                       "ReferenceTrial"]:
            result = await session.run(f"MATCH (n:{label}) RETURN count(n) AS cnt")
            record = await result.single()
            counts[label] = record["cnt"]

        logger.info("Node counts:")
        for label, cnt in counts.items():
            logger.info(f"  {label}: {cnt}")

        # Check orphaned cells (every cell should have IN_ARM and IN_EPOCH)
        result = await session.run("""
            MATCH (c:StudyCell)
            WHERE NOT (c)-[:IN_ARM]->(:StudyArm)
               OR NOT (c)-[:IN_EPOCH]->(:StudyEpoch)
            RETURN count(c) AS orphaned
        """)
        record = await result.single()
        orphaned = record["orphaned"]
        if orphaned > 0:
            logger.warning(f"  {orphaned} orphaned StudyCell nodes (missing arm or epoch)")
        else:
            logger.info("  All StudyCell nodes have IN_ARM and IN_EPOCH relationships")

        # Check instances have AT_ENCOUNTER
        result = await session.run("""
            MATCH (i:ScheduledActivityInstance)
            WHERE NOT (i)-[:AT_ENCOUNTER]->(:Encounter)
            RETURN count(i) AS orphaned
        """)
        record = await result.single()
        orphaned = record["orphaned"]
        if orphaned > 0:
            logger.warning(f"  {orphaned} ScheduledActivityInstance nodes without AT_ENCOUNTER")
        else:
            logger.info("  All ScheduledActivityInstance nodes have AT_ENCOUNTER relationships")

    await close_driver()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        asyncio.run(verify())
    else:
        asyncio.run(migrate())
        print("\nRunning verification...")
        asyncio.run(verify())
