"""
API-level integration tests.

Tests the full FastAPI application via TestClient — no mocking.
Requires a running Neo4j instance (local or Docker).

Run:  cd backend && python -m pytest tests/test_api_health.py -v
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
# Health Check
# ---------------------------------------------------------------------------

class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health_endpoint_returns_200(self, client):
        """Health endpoint must always respond (even in degraded mode)."""
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("ok", "degraded")
        assert "version" in data

    @pytest.mark.asyncio
    async def test_health_reports_neo4j_status(self, client):
        """Health check should report graph connection status."""
        resp = await client.get("/api/health")
        data = resp.json()
        assert "graph" in data
        assert data["graph"] in ("neo4j_connected", "not_connected")

    @pytest.mark.asyncio
    async def test_health_reports_ct_status(self, client):
        """Health check should report CT loading status."""
        resp = await client.get("/api/health")
        data = resp.json()
        # CT can be loaded or not — both are valid
        if data["graph"] == "neo4j_connected":
            assert "ct" in data


# ---------------------------------------------------------------------------
# Protocol CRUD (basic smoke tests)
# ---------------------------------------------------------------------------

class TestProtocolAPI:
    """Protocol CRUD tests — these hit Neo4j, so they may fail
    if there's an event loop conflict. Use test_production.py for
    reliable protocol testing against the live API."""

    @pytest.mark.asyncio
    async def test_list_protocols(self, client):
        """GET /api/protocols should return a list."""
        try:
            resp = await client.get("/api/protocols")
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)
        except RuntimeError as e:
            if "different loop" in str(e):
                pytest.skip("Event loop conflict with Neo4j driver in test")
            raise

    @pytest.mark.asyncio
    async def test_get_nonexistent_protocol_returns_404(self, client):
        """GET a non-existent protocol should return 404."""
        try:
            resp = await client.get("/api/protocols/00000000-0000-0000-0000-000000000000")
            assert resp.status_code == 404
        except RuntimeError as e:
            if "different loop" in str(e):
                pytest.skip("Event loop conflict with Neo4j driver in test")
            raise
