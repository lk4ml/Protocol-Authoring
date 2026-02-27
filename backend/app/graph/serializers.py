"""
Serializers: Convert Neo4j Protocol node dicts to the same JSON shapes
that the SQLite-based API returns.

These functions ensure the API contract stays identical when switching
from SQLite reads to Neo4j reads — the frontend sees no difference.
"""

from __future__ import annotations

import json
from typing import Any


def protocol_to_summary(proto: dict) -> dict:
    """Convert a Protocol node dict to the summary format for list endpoints."""
    return {
        "id": proto.get("id", ""),
        "protocolNumber": proto.get("protocolNumber", ""),
        "shortTitle": proto.get("shortTitle", ""),
        "phase": proto.get("phase", ""),
        "therapeuticArea": proto.get("therapeuticArea", ""),
        "status": proto.get("status", "Draft"),
        "updatedAt": proto.get("updatedAt", ""),
    }


def protocol_to_full(proto: dict, design_data: dict | None = None,
                     reference_trials: list | None = None) -> dict:
    """
    Convert a Protocol node dict to the full format.

    If design_data and reference_trials are provided, they are included
    as the nested studyDesignData and referenceTrials fields.
    """
    narrative_raw = proto.get("narrativeSections", "{}")
    if isinstance(narrative_raw, str):
        try:
            narrative = json.loads(narrative_raw)
        except (json.JSONDecodeError, TypeError):
            narrative = {}
    else:
        narrative = narrative_raw or {}

    return {
        "id": proto.get("id", ""),
        "protocolNumber": proto.get("protocolNumber", ""),
        "fullTitle": proto.get("fullTitle", ""),
        "shortTitle": proto.get("shortTitle", ""),
        "phase": proto.get("phase", ""),
        "studyType": proto.get("studyType", ""),
        "therapeuticArea": proto.get("therapeuticArea", ""),
        "indication": proto.get("indication", ""),
        "sponsorName": proto.get("sponsorName", ""),
        "sampleSize": proto.get("sampleSize"),
        "status": proto.get("status", "Draft"),
        "version": proto.get("version", "1.0"),
        "templateId": proto.get("templateId"),
        "studyDesignData": design_data or {},
        "narrativeSections": narrative,
        "referenceTrials": reference_trials or [],
        "createdAt": proto.get("createdAt", ""),
        "updatedAt": proto.get("updatedAt", ""),
    }
