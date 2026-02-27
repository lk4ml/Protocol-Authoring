"""
Neo4j graph database driver lifecycle.

Provides async driver management for FastAPI integration.
The driver is created once on startup and shared across requests.
"""

from contextlib import asynccontextmanager
from neo4j import AsyncGraphDatabase, AsyncDriver

from ..config import settings

_driver: AsyncDriver | None = None


async def get_driver() -> AsyncDriver:
    """Return the shared Neo4j async driver, creating it if needed."""
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
    return _driver


async def close_driver():
    """Cleanly shut down the Neo4j driver."""
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None


@asynccontextmanager
async def get_session():
    """Yield an async Neo4j session for use in routers / services."""
    driver = await get_driver()
    async with driver.session() as session:
        yield session


async def verify_connectivity():
    """Check that Neo4j is reachable. Returns True or raises."""
    driver = await get_driver()
    await driver.verify_connectivity()
    return True
