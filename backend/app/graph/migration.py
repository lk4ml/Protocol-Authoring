"""
One-time migration script: SQLite → Neo4j.

Reads all protocols from the SQLite database and writes them to Neo4j
as proper graph nodes and relationships.

Usage:
    cd backend
    python -m app.graph.migration

Idempotent: Uses MERGE for the Protocol node so it's safe to re-run.
Child nodes are replaced (delete + create) per protocol.

NOTE: This script directly reads the SQLite file without going through
the app's Settings (which no longer has DATABASE_URL). It uses the neo4j
driver via app.graph.
"""

import asyncio
import json
import logging
import sqlite3
import sys
import os

# Ensure the app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Direct path to the SQLite database
SQLITE_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "protocol_authoring.db"
)


def _read_sqlite_protocols() -> list[dict]:
    """Read all protocols directly from SQLite without SQLAlchemy."""
    if not os.path.exists(SQLITE_DB_PATH):
        logger.warning(f"SQLite database not found: {SQLITE_DB_PATH}")
        return []

    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM protocols ORDER BY updated_at DESC")
        rows = cursor.fetchall()
    except sqlite3.OperationalError as e:
        logger.error(f"SQLite query error: {e}")
        return []
    finally:
        conn.close()

    protocols = []
    for row in rows:
        d = dict(row)
        # Parse JSON columns
        for json_col in ["study_design_data", "narrative_sections", "reference_trials"]:
            val = d.get(json_col)
            if isinstance(val, str):
                try:
                    d[json_col] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    d[json_col] = {} if json_col != "reference_trials" else []
            elif val is None:
                d[json_col] = {} if json_col != "reference_trials" else []
        protocols.append(d)

    return protocols


async def migrate():
    from app.graph import get_driver, close_driver
    from app.graph.schema import ensure_constraints
    from app.graph import crud as graph_crud

    # 1. Apply constraints/indexes
    driver = await get_driver()
    logger.info("Applying Neo4j constraints and indexes...")
    await ensure_constraints(driver)

    # 2. Read all protocols from SQLite
    protocols = _read_sqlite_protocols()
    logger.info(f"Found {len(protocols)} protocols in SQLite")

    if not protocols:
        logger.info("No protocols to migrate.")
        await close_driver()
        return

    # 3. Migrate each protocol
    for idx, protocol in enumerate(protocols, 1):
        pid = protocol.get("id", "")
        pnum = protocol.get("protocol_number", "")
        logger.info(f"[{idx}/{len(protocols)}] Migrating: {pnum} (id={pid})")

        async with driver.session() as session:
            # Create/update Protocol node
            await graph_crud.create_protocol(session, {
                "id": pid,
                "protocolNumber": pnum,
                "shortTitle": protocol.get("short_title", ""),
                "fullTitle": protocol.get("full_title", ""),
                "phase": protocol.get("phase", ""),
                "studyType": protocol.get("study_type", ""),
                "therapeuticArea": protocol.get("therapeutic_area", ""),
                "indication": protocol.get("indication", ""),
                "sponsorName": protocol.get("sponsor_name", ""),
                "status": protocol.get("status", "Draft"),
                "version": protocol.get("version", "1.0"),
                "sampleSize": protocol.get("sample_size"),
                "templateId": protocol.get("template_id"),
                "narrativeSections": protocol.get("narrative_sections", {}),
            })

            # Save design entities
            sdd = protocol.get("study_design_data", {})
            if sdd:
                logger.info(f"  Writing design data ({len(sdd.get('studyArms', []))} arms, "
                            f"{len(sdd.get('studyEpochs', []))} epochs, "
                            f"{len(sdd.get('studyCells', []))} cells, "
                            f"{len(sdd.get('activities', []))} activities)")
                await graph_crud.save_design(session, pid, sdd)
                await graph_crud.save_schedule(session, pid, sdd)

            # Save reference trials
            refs = protocol.get("reference_trials", [])
            if refs:
                logger.info(f"  Writing {len(refs)} reference trials")
                await graph_crud.save_reference_trials(session, pid, refs)

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
