"""
Shared pytest fixtures and configuration.
"""

import pytest


def pytest_collection_modifyitems(config, items):
    """Add markers to tests based on their module."""
    for item in items:
        if "production" in item.module.__name__:
            item.add_marker(pytest.mark.production)
        if "neo4j" in item.module.__name__:
            item.add_marker(pytest.mark.integration)
