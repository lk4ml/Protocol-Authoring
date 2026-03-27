"""
Neo4j integration tests.

Tests that:
1. Neo4j is reachable and the driver works
2. CT data was loaded correctly (node counts, relationships)
3. CRUD operations work (create, read, update, delete)
4. Graph queries return expected shapes
5. Cross-references (BC → SDTM Domain, CT Package binding) work

Run:  cd backend && python -m pytest tests/test_neo4j_integration.py -v

NOTE: Requires a running Neo4j instance with data loaded.
"""

import pytest
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from neo4j import AsyncGraphDatabase
from app.config import settings


@pytest.fixture
async def driver():
    d = AsyncGraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
    )
    yield d
    await d.close()


@pytest.fixture
async def session():
    d = AsyncGraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
    )
    async with d.session() as s:
        yield s
    await d.close()


# ---------------------------------------------------------------------------
# Connection Tests
# ---------------------------------------------------------------------------

class TestNeo4jConnection:
    @pytest.mark.asyncio
    async def test_driver_connects(self, driver):
        """Neo4j driver should connect successfully."""
        await driver.verify_connectivity()

    @pytest.mark.asyncio
    async def test_can_run_simple_query(self, session):
        """Should be able to run a basic Cypher query."""
        result = await session.run("RETURN 1 AS n")
        record = await result.single()
        assert record["n"] == 1


# ---------------------------------------------------------------------------
# CT Data Integrity in Neo4j
# ---------------------------------------------------------------------------

class TestCTDataInNeo4j:
    @pytest.mark.asyncio
    async def test_ct_catalogue_exists(self, session):
        """At least one CTCatalogue node must exist."""
        result = await session.run("MATCH (c:CTCatalogue) RETURN count(c) AS cnt")
        record = await result.single()
        assert record["cnt"] >= 1, "No CTCatalogue nodes found — CT not loaded"

    @pytest.mark.asyncio
    async def test_ct_package_exists(self, session):
        """At least one CTPackage node must exist."""
        result = await session.run("MATCH (p:CTPackage) RETURN count(p) AS cnt")
        record = await result.single()
        assert record["cnt"] >= 1, "No CTPackage nodes found"

    @pytest.mark.asyncio
    async def test_ct_codelists_loaded(self, session):
        """Should have 1000+ codelists in Neo4j."""
        result = await session.run("MATCH (cl:CTCodelist) RETURN count(cl) AS cnt")
        record = await result.single()
        assert record["cnt"] > 1000, f"Only {record['cnt']} codelists found, expected 1000+"

    @pytest.mark.asyncio
    async def test_ct_terms_loaded(self, session):
        """Should have 25000+ terms in Neo4j."""
        result = await session.run("MATCH (t:CTTerm) RETURN count(t) AS cnt")
        record = await result.single()
        assert record["cnt"] > 25000, f"Only {record['cnt']} terms found, expected 25000+"

    @pytest.mark.asyncio
    async def test_codelist_has_terms_relationship(self, session):
        """Codelists should be linked to terms via HAS_TERM."""
        result = await session.run("""
            MATCH (cl:CTCodelist)-[:HAS_TERM]->(t:CTTerm)
            RETURN count(t) AS cnt
        """)
        record = await result.single()
        assert record["cnt"] > 20000, "HAS_TERM relationships missing or incomplete"

    @pytest.mark.asyncio
    async def test_catalogue_has_package_relationship(self, session):
        """CTCatalogue should link to CTPackage via HAS_PACKAGE."""
        result = await session.run("""
            MATCH (cat:CTCatalogue)-[:HAS_PACKAGE]->(pkg:CTPackage)
            RETURN count(pkg) AS cnt
        """)
        record = await result.single()
        assert record["cnt"] >= 1

    @pytest.mark.asyncio
    async def test_phase_codelist_queryable(self, session):
        """Should be able to query the PHASE codelist and get terms."""
        result = await session.run("""
            MATCH (cl:CTCodelist {submissionValue: 'TPHASE'})-[:HAS_TERM]->(t:CTTerm)
            RETURN t.submissionValue AS val, t.preferredTerm AS name
        """)
        records = [r async for r in result]
        assert len(records) >= 3, f"TPHASE codelist has only {len(records)} terms"


# ---------------------------------------------------------------------------
# Biomedical Concepts in Neo4j
# ---------------------------------------------------------------------------

class TestBiomedicalConceptsInNeo4j:
    @pytest.mark.asyncio
    async def test_bcs_loaded(self, session):
        """Should have 1000+ Biomedical Concepts."""
        result = await session.run("MATCH (bc:BiomedicalConcept) RETURN count(bc) AS cnt")
        record = await result.single()
        assert record["cnt"] > 1000, f"Only {record['cnt']} BCs found"

    @pytest.mark.asyncio
    async def test_decs_loaded(self, session):
        """Should have Data Element Concepts linked to BCs."""
        result = await session.run("MATCH (dec:DataElementConcept) RETURN count(dec) AS cnt")
        record = await result.single()
        assert record["cnt"] > 100, f"Only {record['cnt']} DECs found"

    @pytest.mark.asyncio
    async def test_bc_has_data_element_relationship(self, session):
        """BCs should link to DECs via HAS_DATA_ELEMENT."""
        result = await session.run("""
            MATCH (bc:BiomedicalConcept)-[:HAS_DATA_ELEMENT]->(dec:DataElementConcept)
            RETURN count(dec) AS cnt
        """)
        record = await result.single()
        assert record["cnt"] > 100

    @pytest.mark.asyncio
    async def test_sdtm_domains_loaded(self, session):
        """Should have 50+ SDTM domains."""
        result = await session.run("MATCH (d:SDTMDomain) RETURN count(d) AS cnt")
        record = await result.single()
        assert record["cnt"] >= 50, f"Only {record['cnt']} SDTM domains found"

    @pytest.mark.asyncio
    async def test_bc_in_domain_relationship(self, session):
        """BCs should be linked to SDTM domains via IN_DOMAIN."""
        result = await session.run("""
            MATCH (bc:BiomedicalConcept)-[:IN_DOMAIN]->(d:SDTMDomain)
            RETURN d.code AS domain, count(bc) AS cnt
            ORDER BY cnt DESC LIMIT 5
        """)
        records = [dict(r) async for r in result]
        assert len(records) > 0, "No BC → SDTMDomain relationships found"
        # VS and LB should be top domains
        domain_codes = [r["domain"] for r in records]
        assert any(d in domain_codes for d in ["VS", "LB"]), \
            f"Expected VS or LB in top domains, got {domain_codes}"


# ---------------------------------------------------------------------------
# Activity Library in Neo4j
# ---------------------------------------------------------------------------

class TestActivityLibraryInNeo4j:
    @pytest.mark.asyncio
    async def test_activity_groups_loaded(self, session):
        """Should have ActivityGroupLib nodes."""
        result = await session.run("MATCH (g:ActivityGroupLib) RETURN count(g) AS cnt")
        record = await result.single()
        assert record["cnt"] >= 1, "No ActivityGroupLib nodes found"

    @pytest.mark.asyncio
    async def test_activity_concepts_loaded(self, session):
        """Should have 500+ ActivityConceptLib nodes."""
        result = await session.run("MATCH (a:ActivityConceptLib) RETURN count(a) AS cnt")
        record = await result.single()
        assert record["cnt"] > 500, f"Only {record['cnt']} activity concepts found"


# ---------------------------------------------------------------------------
# Schema Constraints
# ---------------------------------------------------------------------------

class TestSchemaConstraints:
    @pytest.mark.asyncio
    async def test_uniqueness_constraints_exist(self, session):
        """Should have uniqueness constraints on key nodes."""
        result = await session.run("SHOW CONSTRAINTS")
        constraints = [dict(r) async for r in result]
        constraint_labels = [c.get("labelsOrTypes", [None])[0] for c in constraints]
        for expected in ["Protocol", "CTCodelist", "CTTerm", "BiomedicalConcept"]:
            assert expected in constraint_labels, \
                f"Missing uniqueness constraint on {expected}"

    @pytest.mark.asyncio
    async def test_indexes_exist(self, session):
        """Should have indexes for query performance."""
        result = await session.run("SHOW INDEXES")
        indexes = [dict(r) async for r in result]
        assert len(indexes) >= 10, f"Only {len(indexes)} indexes, expected 10+"


# ---------------------------------------------------------------------------
# Protocol CRUD via Neo4j (direct)
# ---------------------------------------------------------------------------

class TestProtocolCRUD:
    @pytest.mark.asyncio
    async def test_create_read_delete_protocol(self, session):
        """Full lifecycle: create → read → delete a protocol."""
        import uuid
        test_id = str(uuid.uuid4())

        # Create
        await session.run("""
            CREATE (p:Protocol {
                id: $id,
                protocolNumber: 'PYTEST-NEO4J-001',
                shortTitle: 'Neo4j Test',
                phase: 'Phase 2',
                therapeuticArea: 'Testing',
                status: 'Draft'
            })
        """, id=test_id)

        # Read
        result = await session.run(
            "MATCH (p:Protocol {id: $id}) RETURN p.protocolNumber AS num",
            id=test_id
        )
        record = await result.single()
        assert record is not None
        assert record["num"] == "PYTEST-NEO4J-001"

        # Delete
        await session.run("MATCH (p:Protocol {id: $id}) DETACH DELETE p", id=test_id)

        # Verify deleted
        result = await session.run(
            "MATCH (p:Protocol {id: $id}) RETURN count(p) AS cnt",
            id=test_id
        )
        record = await result.single()
        assert record["cnt"] == 0

    @pytest.mark.asyncio
    async def test_protocol_with_arm_relationship(self, session):
        """Create a protocol with an arm and verify the relationship."""
        import uuid
        pid = str(uuid.uuid4())
        aid = str(uuid.uuid4())

        try:
            await session.run("""
                CREATE (p:Protocol {id: $pid, protocolNumber: 'PYTEST-ARM-001'})
                CREATE (a:StudyArm {id: $aid, name: 'Treatment', order: 1})
                CREATE (p)-[:HAS_ARM]->(a)
            """, pid=pid, aid=aid)

            # Verify relationship
            result = await session.run("""
                MATCH (p:Protocol {id: $pid})-[:HAS_ARM]->(a:StudyArm)
                RETURN a.name AS name
            """, pid=pid)
            record = await result.single()
            assert record is not None
            assert record["name"] == "Treatment"
        finally:
            # Cleanup
            await session.run("""
                MATCH (p:Protocol {id: $pid})-[r]-(n)
                DELETE r, n, p
            """, pid=pid)
