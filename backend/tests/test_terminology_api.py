"""
Terminology & CT API endpoint tests.

Tests that all terminology and CT endpoints return correct data shapes.

Run:  cd backend && python -m pytest tests/test_terminology_api.py -v
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.fixture
async def client(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Terminology Endpoints (JSON-based, no Neo4j needed)
# ---------------------------------------------------------------------------

class TestTerminologyEndpoints:
    """These should always work, even without Neo4j."""

    ENDPOINTS = [
        "/api/terminology/phases",
        "/api/terminology/study-types",
        "/api/terminology/epoch-types",
        "/api/terminology/arm-types",
        "/api/terminology/intervention-models",
        "/api/terminology/blinding-schemas",
        "/api/terminology/sdtm-domains",
    ]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    async def test_terminology_endpoint_returns_200(self, client, endpoint):
        """Each terminology endpoint must return 200."""
        resp = await client.get(endpoint)
        assert resp.status_code == 200, f"{endpoint} returned {resp.status_code}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    async def test_terminology_endpoint_returns_list(self, client, endpoint):
        """Each terminology endpoint must return a list."""
        resp = await client.get(endpoint)
        data = resp.json()
        assert isinstance(data, list), f"{endpoint} returned {type(data)}, expected list"
        assert len(data) > 0, f"{endpoint} returned empty list"

    @pytest.mark.asyncio
    async def test_phases_has_standard_phases(self, client):
        """Phases endpoint must include standard clinical trial phases."""
        resp = await client.get("/api/terminology/phases")
        data = resp.json()
        labels = [str(p.get("label", p.get("decode", ""))).lower() for p in data]
        assert any("phase 1" in l or "phase i" in l for l in labels), \
            f"Phase 1 not found in {labels}"

    @pytest.mark.asyncio
    async def test_activity_catalog_returns_activities(self, client):
        """Activity catalog must return activities."""
        resp = await client.get("/api/terminology/activity-catalog")
        assert resp.status_code == 200
        data = resp.json()
        assert "activities" in data
        assert len(data["activities"]) > 0

    @pytest.mark.asyncio
    async def test_procedure_library_returns_data(self, client):
        """Procedure library must return data."""
        resp = await client.get("/api/terminology/procedure-library")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_soa_hierarchy_returns_data(self, client):
        """SOA hierarchy must return grouping data."""
        resp = await client.get("/api/terminology/soa-hierarchy")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# CT Endpoints (requires Neo4j with loaded CT data)
# ---------------------------------------------------------------------------

class TestCTEndpoints:
    """These require Neo4j to be running with CT data loaded."""

    @pytest.mark.asyncio
    async def test_ct_stats(self, client):
        """CT stats endpoint should return node counts."""
        resp = await client.get("/api/ct/stats")
        if resp.status_code == 503:
            pytest.skip("CT data not available (Neo4j not connected)")
        assert resp.status_code == 200
        data = resp.json()
        assert "codelists" in data or "terms" in data or isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_ct_catalogues(self, client):
        """Should list CT catalogues."""
        resp = await client.get("/api/ct/catalogues")
        if resp.status_code == 503:
            pytest.skip("CT data not available")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_ct_packages(self, client):
        """Should list CT packages."""
        resp = await client.get("/api/ct/packages")
        if resp.status_code == 503:
            pytest.skip("CT data not available")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_ct_codelists_search(self, client):
        """Should search codelists."""
        resp = await client.get("/api/ct/codelists", params={"search": "PHASE"})
        if resp.status_code == 503:
            pytest.skip("CT data not available")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_ct_terms_search(self, client):
        """Should search terms."""
        resp = await client.get("/api/ct/terms", params={"query": "Phase 2", "limit": 5})
        if resp.status_code == 503:
            pytest.skip("CT data not available")
        assert resp.status_code in (200, 422), f"Unexpected: {resp.status_code} {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_ct_biomedical_concepts(self, client):
        """Should list biomedical concepts."""
        resp = await client.get("/api/ct/biomedical-concepts", params={"limit": 5})
        if resp.status_code == 503:
            pytest.skip("CT data not available")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            bc = data[0]
            assert "conceptId" in bc
            assert "shortName" in bc

    @pytest.mark.asyncio
    async def test_ct_bc_categories(self, client):
        """Should list BC categories."""
        resp = await client.get("/api/ct/biomedical-concepts/categories")
        if resp.status_code == 503:
            pytest.skip("CT data not available")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_ct_sdtm_domains(self, client):
        """Should list SDTM domains with BC counts."""
        resp = await client.get("/api/ct/sdtm-domains")
        if resp.status_code == 503:
            pytest.skip("CT data not available")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Export Endpoint
# ---------------------------------------------------------------------------

class TestExportEndpoints:
    @pytest.mark.asyncio
    async def test_export_nonexistent_protocol(self, client):
        """Export should fail gracefully for non-existent protocol."""
        resp = await client.get(
            "/api/protocols/00000000-0000-0000-0000-000000000000/export/usdm"
        )
        assert resp.status_code in (404, 422, 500)
