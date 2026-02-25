"""
Template service for loading protocol templates and creating protocols from them.

Templates are stored as JSON files in the ../templates/ directory relative to this
module. Each template provides a pre-populated protocol structure that can be merged
with user-supplied overrides (protocolNumber, fullTitle, etc.) to produce a new
protocol record ready for database insertion.
"""

from __future__ import annotations

import copy
import json
import uuid
from pathlib import Path
from typing import Any, Optional

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _load_json(path: Path) -> dict:
    """Read and parse a JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def list_templates() -> list[dict[str, str]]:
    """Return a list of available templates with id, name, and description.

    Scans the templates directory for *.json files and extracts summary
    metadata from each.
    """
    templates: list[dict[str, str]] = []
    if not TEMPLATES_DIR.is_dir():
        return templates

    for json_file in sorted(TEMPLATES_DIR.glob("*.json")):
        try:
            data = _load_json(json_file)
            templates.append({
                "id": data.get("id", json_file.stem),
                "name": data.get("name", json_file.stem),
                "description": data.get("description", ""),
            })
        except (json.JSONDecodeError, KeyError):
            continue  # skip malformed files

    return templates


def get_template(template_id: str) -> Optional[dict]:
    """Load and return the full JSON template for the given *template_id*.

    The template_id corresponds to the stem of the JSON filename (e.g.
    ``"blank"`` for ``blank.json``).  Returns ``None`` if the template is
    not found.
    """
    template_path = TEMPLATES_DIR / f"{template_id}.json"
    if not template_path.is_file():
        return None
    return _load_json(template_path)


def create_protocol_from_template(
    template_id: str,
    overrides: Optional[dict[str, Any]] = None,
) -> dict:
    """Create a new protocol dict by merging a template with user overrides.

    The returned dictionary is shaped for direct insertion into the
    ``protocols`` database table via the :class:`ProtocolDB` model.

    Parameters
    ----------
    template_id:
        Identifier of the template to base the protocol on.
    overrides:
        User-supplied values that take precedence over the template
        defaults.  Recognised keys include ``protocolNumber``,
        ``fullTitle``, ``shortTitle``, ``phase``, ``studyType``,
        ``therapeuticArea``, ``indication``, ``sponsorName``,
        ``sampleSize``, and any other metadata-level field.

    Returns
    -------
    dict
        A flat dictionary suitable for constructing a ``ProtocolDB`` row:
        ``id``, ``protocol_number``, ``full_title``, ``short_title``,
        ``phase``, ``study_type``, ``therapeutic_area``, ``indication``,
        ``sponsor_name``, ``sample_size``, ``template_id``, ``version``,
        ``study_design_data``, ``narrative_sections``.
    """
    template = get_template(template_id)
    if template is None:
        raise ValueError(f"Template '{template_id}' not found")

    overrides = overrides or {}

    # Deep-copy the template so mutations don't affect the cached file.
    template = copy.deepcopy(template)

    metadata = template.get("metadata", {})
    study_design = template.get("studyDesignData", {})
    narrative = template.get("narrativeSections", {})

    # Merge user overrides into metadata.
    for key, value in overrides.items():
        if key in metadata:
            metadata[key] = value

    # Regenerate UUIDs for every entity inside studyDesignData so that
    # each protocol created from the same template has unique identifiers.
    _regenerate_ids(study_design)

    protocol_id = str(uuid.uuid4())

    return {
        "id": protocol_id,
        "protocol_number": overrides.get("protocolNumber", metadata.get("protocolNumber", "")),
        "full_title": overrides.get("fullTitle", metadata.get("fullTitle", "")),
        "short_title": overrides.get("shortTitle", metadata.get("shortTitle", "")),
        "phase": overrides.get("phase", metadata.get("phase", "")),
        "study_type": overrides.get("studyType", metadata.get("studyType", "Interventional Study")),
        "therapeutic_area": overrides.get("therapeuticArea", metadata.get("therapeuticArea", "")),
        "indication": overrides.get("indication", metadata.get("indication", "")),
        "sponsor_name": overrides.get("sponsorName", metadata.get("sponsorName", "")),
        "sample_size": overrides.get("sampleSize", metadata.get("sampleSize")),
        "template_id": template_id,
        "version": overrides.get("version", "1.0"),
        "status": "Draft",
        "study_design_data": study_design,
        "narrative_sections": narrative,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _regenerate_ids(study_design: dict) -> None:
    """Walk through *study_design* and replace every ``"id"`` field with a
    fresh UUID.  Cross-references (fields ending in ``Id`` or ``Ids``) are
    updated to point to the new UUIDs so that internal consistency is
    maintained.
    """
    # Phase 1 -- collect old -> new ID mapping for all entities that have an
    # "id" key.
    id_map: dict[str, str] = {}

    def _collect_ids(obj: Any) -> None:
        if isinstance(obj, dict):
            if "id" in obj and isinstance(obj["id"], str):
                old_id = obj["id"]
                new_id = str(uuid.uuid4())
                id_map[old_id] = new_id
            for v in obj.values():
                _collect_ids(v)
        elif isinstance(obj, list):
            for item in obj:
                _collect_ids(item)

    _collect_ids(study_design)

    # Phase 2 -- apply the mapping to all id / reference fields.
    def _apply_ids(obj: Any) -> Any:
        if isinstance(obj, dict):
            new_dict: dict[str, Any] = {}
            for key, value in obj.items():
                if key == "id" and isinstance(value, str) and value in id_map:
                    new_dict[key] = id_map[value]
                elif key.endswith("Id") and isinstance(value, str) and value in id_map:
                    new_dict[key] = id_map[value]
                elif key.endswith("Ids") and isinstance(value, list):
                    new_dict[key] = [
                        id_map.get(v, v) if isinstance(v, str) else v
                        for v in value
                    ]
                else:
                    new_dict[key] = _apply_ids(value)
            return new_dict
        elif isinstance(obj, list):
            return [_apply_ids(item) for item in obj]
        else:
            return obj

    result = _apply_ids(study_design)

    # Mutate the original dict in-place so the caller sees changes.
    study_design.clear()
    study_design.update(result)
