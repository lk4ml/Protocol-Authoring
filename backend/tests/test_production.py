"""
Production smoke tests.

Tests the LIVE production deployment at protohelix.com / Railway.
These tests hit the actual production API — use sparingly.

Run:  cd backend && python -m pytest tests/test_production.py -v
"""

import pytest
import httpx

BACKEND_URL = "https://protocol-authoring-production.up.railway.app"
FRONTEND_URL = "https://protohelix.com"


# ---------------------------------------------------------------------------
# Backend Production Tests
# ---------------------------------------------------------------------------

class TestProductionBackend:
    @pytest.mark.asyncio
    async def test_health_endpoint(self):
        """Production health endpoint must return 200."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/health", timeout=15)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["graph"] == "neo4j_connected"

    @pytest.mark.asyncio
    async def test_ct_stats_loaded(self):
        """Production must have CT data loaded."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/health", timeout=15)
        data = resp.json()
        ct = data.get("ct", {})
        if isinstance(ct, dict):
            assert ct.get("terms", 0) > 25000, f"CT terms: {ct.get('terms')}"
            assert ct.get("codelists", 0) > 1000, f"CT codelists: {ct.get('codelists')}"

    @pytest.mark.asyncio
    async def test_protocols_endpoint(self):
        """Production protocols endpoint must work."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/protocols", timeout=15)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_terminology_phases(self):
        """Production terminology endpoint must work."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/terminology/phases", timeout=15)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.asyncio
    async def test_ct_codelists(self):
        """Production CT codelists must be queryable."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/ct/codelists",
                params={"search": "PHASE", "limit": 5},
                timeout=15
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_cors_headers_for_protohelix(self):
        """Backend must accept CORS from protohelix.com."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/health",
                headers={"Origin": "https://protohelix.com"},
                timeout=15
            )
        assert resp.status_code == 200
        cors_header = resp.headers.get("access-control-allow-origin", "")
        assert "protohelix.com" in cors_header, \
            f"CORS not set for protohelix.com: {cors_header}"

    @pytest.mark.asyncio
    async def test_swagger_docs_accessible(self):
        """Swagger docs must be accessible."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/docs", timeout=15)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_api_version(self):
        """API version should be 3.0.0."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/health", timeout=15)
        data = resp.json()
        assert data.get("version") == "3.0.0"
