"""
Activity Concept Library — cross-study reusable activity definitions.

Implements the OpenStudyBuilder-style 4-level hierarchy:
  ActivityGroupLib → ActivitySubGroupLib → ActivityConceptLib → ActivityInstanceLib

Library nodes are built from our existing procedure_library.json + CDISC BC data.
Study-level activities (ActivityValue) reference library concepts via
REFERENCES_CONCEPT relationships.
"""

import json
import logging
import uuid
from pathlib import Path

from neo4j import AsyncDriver, AsyncSession

logger = logging.getLogger(__name__)

TERMINOLOGY_DIR = Path(__file__).parent.parent / "terminology"
BATCH_SIZE = 200


# ---------------------------------------------------------------------------
# Library loading (from procedure_library.json)
# ---------------------------------------------------------------------------

async def load_activity_library(driver: AsyncDriver) -> dict:
    """Load the activity concept library into Neo4j.

    Source: procedure_library.json (built from CDISC BCs + NCI EVS)
    Idempotent — skips if library nodes already exist.
    """
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n:ActivityGroupLib) RETURN count(n) AS c"
        )
        record = await result.single()
        if record and record["c"] > 0:
            logger.info("Activity library already loaded, skipping")
            return {"status": "already_loaded"}

    return await _load_library_unchecked(driver)


async def force_reload_library(driver: AsyncDriver) -> dict:
    """Drop and reload the activity library."""
    async with driver.session() as session:
        for label in ["ActivityInstanceLib", "ActivityConceptLib",
                       "ActivitySubGroupLib", "ActivityGroupLib"]:
            await session.run(f"MATCH (n:{label}) DETACH DELETE n")
    return await _load_library_unchecked(driver)


async def _load_library_unchecked(driver: AsyncDriver) -> dict:
    """Load library without checking if already loaded."""
    lib_file = TERMINOLOGY_DIR / "procedure_library.json"
    if not lib_file.exists():
        logger.warning(f"Procedure library not found: {lib_file}")
        return {"error": "file_not_found"}

    with open(lib_file, "r", encoding="utf-8") as f:
        lib_data = json.load(f)

    # Also load the SOA hierarchy for group structure
    soa_file = TERMINOLOGY_DIR / "soa_hierarchy.json"
    soa_data = {}
    if soa_file.exists():
        with open(soa_file, "r", encoding="utf-8") as f:
            soa_data = json.load(f)

    counts = {"groups": 0, "subgroups": 0, "concepts": 0, "instances": 0}

    async with driver.session() as session:
        # Step 1: Create ActivityGroupLib from SOA hierarchy
        soa_groups = soa_data.get("soaGroups", [])
        if soa_groups:
            group_params = [
                {
                    "id": g.get("id", str(uuid.uuid4())),
                    "name": g.get("name", ""),
                    "description": g.get("description", ""),
                    "order": g.get("order", i),
                }
                for i, g in enumerate(soa_groups)
            ]
            await session.run("""
                UNWIND $items AS item
                MERGE (g:ActivityGroupLib {id: item.id})
                SET g.name = item.name,
                    g.description = item.description,
                    g.order = item.order
            """, items=group_params)
            counts["groups"] = len(group_params)

        # Step 2: Create ActivitySubGroupLib from activityGroups
        act_groups = soa_data.get("activityGroups", [])
        if act_groups:
            subgroup_params = [
                {
                    "id": ag.get("id", str(uuid.uuid4())),
                    "name": ag.get("name", ""),
                    "soaGroupId": ag.get("soaGroupId", ""),
                    "order": ag.get("order", i),
                }
                for i, ag in enumerate(act_groups)
            ]
            await session.run("""
                UNWIND $items AS item
                MERGE (sg:ActivitySubGroupLib {id: item.id})
                SET sg.name = item.name,
                    sg.order = item.order
                WITH sg, item
                MATCH (g:ActivityGroupLib {id: item.soaGroupId})
                MERGE (g)-[:HAS_SUBGROUP]->(sg)
            """, items=subgroup_params)
            counts["subgroups"] = len(subgroup_params)

        # Step 3: Create ActivityConceptLib from procedures
        # Merge all procedures from core + therapeutic areas
        all_procedures = []

        core = lib_data.get("coreProcedures", [])
        for proc in core:
            proc["_source"] = "core"
        all_procedures.extend(core)

        ta_procs = lib_data.get("taProcedures", {})
        for ta_name, procs in ta_procs.items():
            for proc in procs:
                proc["_source"] = ta_name
            all_procedures.extend(procs)

        # Deduplicate by nciCode or name
        seen = set()
        unique_procs = []
        for proc in all_procedures:
            key = proc.get("nciCode", "") or proc.get("name", "")
            if key and key not in seen:
                seen.add(key)
                unique_procs.append(proc)

        # Batch create concepts
        for i in range(0, len(unique_procs), BATCH_SIZE):
            batch = unique_procs[i:i + BATCH_SIZE]
            concept_params = []

            for proc in batch:
                concept_params.append({
                    "id": proc.get("nciCode", str(uuid.uuid4())),
                    "name": proc.get("name", ""),
                    "nciCode": proc.get("nciCode", ""),
                    "loincCode": proc.get("loincCode", ""),
                    "definition": proc.get("definition", ""),
                    "sdtmDomain": proc.get("sdtmDomain", ""),
                    "categories": proc.get("cdiscCategories", []),
                    "synonyms": proc.get("synonyms", []),
                    "therapeuticAreas": proc.get("therapeuticAreas", []),
                    "soaGroupId": proc.get("soaGroupId", ""),
                    "activityGroupId": proc.get("activityGroupId", ""),
                    "source": proc.get("source", "CDISC"),
                })

            if concept_params:
                await session.run("""
                    UNWIND $items AS item
                    MERGE (c:ActivityConceptLib {id: item.id})
                    SET c.name = item.name,
                        c.nciCode = item.nciCode,
                        c.loincCode = item.loincCode,
                        c.definition = item.definition,
                        c.sdtmDomain = item.sdtmDomain,
                        c.categories = item.categories,
                        c.synonyms = item.synonyms,
                        c.therapeuticAreas = item.therapeuticAreas,
                        c.source = item.source
                """, items=concept_params)

                # Link concepts to subgroups
                await session.run("""
                    UNWIND $items AS item
                    MATCH (c:ActivityConceptLib {id: item.id})
                    WITH c, item
                    WHERE item.activityGroupId IS NOT NULL
                      AND item.activityGroupId <> ''
                    MATCH (sg:ActivitySubGroupLib {id: item.activityGroupId})
                    MERGE (sg)-[:HAS_CONCEPT]->(c)
                """, items=concept_params)

                counts["concepts"] += len(concept_params)

        # Step 4: Link concepts to BiomedicalConcepts (if CT loaded)
        await session.run("""
            MATCH (c:ActivityConceptLib)
            WHERE c.nciCode IS NOT NULL AND c.nciCode <> ''
            MATCH (bc:BiomedicalConcept {conceptId: c.nciCode})
            MERGE (c)-[:MAPS_TO_BC]->(bc)
        """)

        # Step 5: Link concepts to SDTM domains
        await session.run("""
            MATCH (c:ActivityConceptLib)
            WHERE c.sdtmDomain IS NOT NULL AND c.sdtmDomain <> ''
            MATCH (d:SDTMDomain {code: c.sdtmDomain})
            MERGE (c)-[:IN_DOMAIN]->(d)
        """)

    logger.info(f"Activity library loaded: {counts}")
    return counts


# ---------------------------------------------------------------------------
# Library query operations
# ---------------------------------------------------------------------------

async def list_groups(session: AsyncSession) -> list[dict]:
    """List all library activity groups with subgroup counts."""
    result = await session.run("""
        MATCH (g:ActivityGroupLib)
        OPTIONAL MATCH (g)-[:HAS_SUBGROUP]->(sg:ActivitySubGroupLib)
        RETURN g.id AS id,
               g.name AS name,
               g.description AS description,
               g.order AS order,
               count(sg) AS subgroupCount
        ORDER BY g.order
    """)
    return [dict(r) async for r in result]


async def get_group_with_subgroups(
    session: AsyncSession, group_id: str
) -> dict | None:
    """Get a group with all subgroups and their concept counts."""
    result = await session.run("""
        MATCH (g:ActivityGroupLib {id: $gid})
        OPTIONAL MATCH (g)-[:HAS_SUBGROUP]->(sg:ActivitySubGroupLib)
        OPTIONAL MATCH (sg)-[:HAS_CONCEPT]->(c:ActivityConceptLib)
        RETURN g.id AS id,
               g.name AS name,
               g.description AS description,
               collect(DISTINCT {
                   id: sg.id,
                   name: sg.name,
                   order: sg.order,
                   conceptCount: count(c)
               }) AS subgroups
    """, gid=group_id)
    record = await result.single()
    if not record:
        return None
    d = dict(record)
    d["subgroups"] = [sg for sg in d["subgroups"] if sg.get("id")]
    return d


async def list_concepts(
    session: AsyncSession,
    subgroup_id: str = None,
    domain: str = None,
    search: str = None,
    therapeutic_area: str = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """List activity concepts with filters."""
    params = {"limit": limit, "offset": offset}
    match_clause = "MATCH (c:ActivityConceptLib)"
    where_parts = []

    if subgroup_id:
        match_clause = """
            MATCH (sg:ActivitySubGroupLib {id: $sgId})-[:HAS_CONCEPT]->(c:ActivityConceptLib)
        """
        params["sgId"] = subgroup_id

    if domain:
        where_parts.append("c.sdtmDomain = $domain")
        params["domain"] = domain
    if search:
        where_parts.append(
            "(c.name CONTAINS $search OR c.nciCode CONTAINS $search)"
        )
        params["search"] = search
    if therapeutic_area:
        where_parts.append("$ta IN c.therapeuticAreas")
        params["ta"] = therapeutic_area

    where = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    result = await session.run(f"""
        {match_clause}
        {where}
        OPTIONAL MATCH (c)-[:IN_DOMAIN]->(d:SDTMDomain)
        OPTIONAL MATCH (c)-[:MAPS_TO_BC]->(bc:BiomedicalConcept)
        RETURN c.id AS id,
               c.name AS name,
               c.nciCode AS nciCode,
               c.definition AS definition,
               c.sdtmDomain AS sdtmDomain,
               c.categories AS categories,
               c.therapeuticAreas AS therapeuticAreas,
               c.source AS source,
               d.name AS sdtmDomainName,
               bc.shortName AS bcShortName
        ORDER BY c.name
        SKIP $offset LIMIT $limit
    """, **params)
    return [dict(r) async for r in result]


async def get_concept(session: AsyncSession, concept_id: str) -> dict | None:
    """Get a single activity concept with all relationships."""
    result = await session.run("""
        MATCH (c:ActivityConceptLib {id: $cid})
        OPTIONAL MATCH (c)-[:IN_DOMAIN]->(d:SDTMDomain)
        OPTIONAL MATCH (c)-[:MAPS_TO_BC]->(bc:BiomedicalConcept)
        OPTIONAL MATCH (bc)-[:HAS_DATA_ELEMENT]->(dec:DataElementConcept)
        OPTIONAL MATCH (sg:ActivitySubGroupLib)-[:HAS_CONCEPT]->(c)
        OPTIONAL MATCH (g:ActivityGroupLib)-[:HAS_SUBGROUP]->(sg)
        OPTIONAL MATCH (c)-[:HAS_INSTANCE]->(inst:ActivityInstanceLib)
        RETURN c.id AS id,
               c.name AS name,
               c.nciCode AS nciCode,
               c.loincCode AS loincCode,
               c.definition AS definition,
               c.sdtmDomain AS sdtmDomain,
               c.categories AS categories,
               c.synonyms AS synonyms,
               c.therapeuticAreas AS therapeuticAreas,
               c.source AS source,
               d.code AS domainCode,
               d.name AS domainName,
               bc.conceptId AS bcConceptId,
               bc.shortName AS bcShortName,
               sg.id AS subgroupId,
               sg.name AS subgroupName,
               g.id AS groupId,
               g.name AS groupName,
               collect(DISTINCT {
                   conceptId: dec.conceptId,
                   shortName: dec.shortName,
                   dataType: dec.dataType
               }) AS dataElements,
               collect(DISTINCT {
                   id: inst.id,
                   name: inst.name,
                   qualifier: inst.qualifier
               }) AS instances
    """, cid=concept_id)
    record = await result.single()
    if not record:
        return None

    d = dict(record)
    d["dataElements"] = [de for de in d["dataElements"] if de.get("conceptId")]
    d["instances"] = [i for i in d["instances"] if i.get("id")]
    return d


async def search_library(
    session: AsyncSession, query: str, limit: int = 30
) -> list[dict]:
    """Full-text search across the activity library."""
    result = await session.run("""
        MATCH (c:ActivityConceptLib)
        WHERE c.name CONTAINS $query
           OR c.nciCode CONTAINS $query
           OR c.definition CONTAINS $query
           OR ANY(syn IN c.synonyms WHERE syn CONTAINS $query)
        OPTIONAL MATCH (c)-[:IN_DOMAIN]->(d:SDTMDomain)
        RETURN c.id AS id,
               c.name AS name,
               c.nciCode AS nciCode,
               c.sdtmDomain AS sdtmDomain,
               c.source AS source,
               d.name AS domainName
        ORDER BY c.name
        LIMIT $limit
    """, query=query, limit=limit)
    return [dict(r) async for r in result]


# ---------------------------------------------------------------------------
# Study → Library linking
# ---------------------------------------------------------------------------

async def link_study_activity_to_concept(
    session: AsyncSession,
    activity_id: str,
    concept_id: str,
) -> bool:
    """Link a study-level Activity to a library-level concept."""
    result = await session.run("""
        MATCH (a:Activity {id: $aid})
        MATCH (c:ActivityConceptLib {id: $cid})
        MERGE (a)-[:REFERENCES_CONCEPT]->(c)
        RETURN a.id AS aid
    """, aid=activity_id, cid=concept_id)
    record = await result.single()
    return record is not None


async def get_library_stats(session: AsyncSession) -> dict:
    """Get counts of all library node types."""
    result = await session.run("""
        OPTIONAL MATCH (g:ActivityGroupLib) WITH count(g) AS groups
        OPTIONAL MATCH (sg:ActivitySubGroupLib) WITH groups, count(sg) AS subgroups
        OPTIONAL MATCH (c:ActivityConceptLib)
        WITH groups, subgroups, count(c) AS concepts
        OPTIONAL MATCH (i:ActivityInstanceLib)
        WITH groups, subgroups, concepts, count(i) AS instances
        OPTIONAL MATCH (:ActivityConceptLib)-[:MAPS_TO_BC]->(:BiomedicalConcept)
        WITH groups, subgroups, concepts, instances, count(*) AS bcLinks
        OPTIONAL MATCH (:ActivityConceptLib)-[:IN_DOMAIN]->(:SDTMDomain)
        RETURN groups, subgroups, concepts, instances, bcLinks,
               count(*) AS domainLinks
    """)
    record = await result.single()
    return dict(record) if record else {}
