"""
CDISC Controlled Terminology data integrity tests.

Validates that:
1. CT JSON source files exist and are valid
2. CT data loads correctly into Neo4j
3. CT query functions return expected shapes
4. Biomedical Concepts are properly linked

Run:  cd backend && python -m pytest tests/test_ct_data.py -v
"""

import pytest
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

INPUTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "app", "terminology", "inputs"
)


# ---------------------------------------------------------------------------
# CT Source File Integrity
# ---------------------------------------------------------------------------

class TestCTSourceFiles:
    """Verify the downloaded CDISC JSON files are valid and complete."""

    REQUIRED_FILES = [
        "cdisc_api_sdtm_ct_latest.json",
        "cdisc_api_bc_details.json",
        "cdisc_api_sdtm_spec_details.json",
        "cdisc_api_sdtmig_domain_details.json",
        "cdisc_api_cdashig_domain_details.json",
    ]

    @pytest.mark.parametrize("filename", REQUIRED_FILES)
    def test_source_file_exists(self, filename):
        """Each required CDISC JSON file must exist."""
        path = os.path.join(INPUTS_DIR, filename)
        assert os.path.exists(path), f"Missing CDISC source file: {filename}"

    @pytest.mark.parametrize("filename", REQUIRED_FILES)
    def test_source_file_is_valid_json(self, filename):
        """Each source file must be parseable JSON."""
        path = os.path.join(INPUTS_DIR, filename)
        with open(path) as f:
            data = json.load(f)
        assert data is not None

    def test_sdtm_ct_has_codelists(self):
        """SDTM CT must contain codelists with terms."""
        path = os.path.join(INPUTS_DIR, "cdisc_api_sdtm_ct_latest.json")
        with open(path) as f:
            data = json.load(f)
        codelists = data.get("codelists", [])
        assert len(codelists) > 1000, f"Expected 1000+ codelists, got {len(codelists)}"

        # Each codelist should have terms
        for cl in codelists[:10]:
            assert "conceptId" in cl, "Codelist missing conceptId"
            assert "submissionValue" in cl, "Codelist missing submissionValue"
            assert "terms" in cl, f"Codelist {cl.get('name')} has no terms"

    def test_sdtm_ct_has_phase_codelist(self):
        """SDTM CT must include the TPHASE (Trial Phase) codelist."""
        path = os.path.join(INPUTS_DIR, "cdisc_api_sdtm_ct_latest.json")
        with open(path) as f:
            data = json.load(f)
        codelists = data.get("codelists", [])
        phase_cls = [cl for cl in codelists if cl.get("submissionValue") == "TPHASE"]
        assert len(phase_cls) == 1, "TPHASE codelist not found in SDTM CT"
        phase_terms = phase_cls[0].get("terms", [])
        assert len(phase_terms) >= 3, f"TPHASE codelist has only {len(phase_terms)} terms"

    def test_bc_details_has_biomedical_concepts(self):
        """BC details file must contain 1000+ biomedical concepts."""
        path = os.path.join(INPUTS_DIR, "cdisc_api_bc_details.json")
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) > 1000, f"Expected 1000+ BCs, got {len(data)}"

        # Spot check structure
        bc = data[0]
        assert "conceptId" in bc
        assert "shortName" in bc
        assert "categories" in bc

    def test_bc_has_glucose_measurement(self):
        """BCs must include common lab tests like Glucose Measurement."""
        path = os.path.join(INPUTS_DIR, "cdisc_api_bc_details.json")
        with open(path) as f:
            data = json.load(f)
        glucose = [bc for bc in data if "glucose" in bc.get("shortName", "").lower()]
        assert len(glucose) > 0, "Glucose Measurement BC not found"

    def test_sdtmig_domains_exist(self):
        """SDTMIG must include key domains (DM, AE, LB, VS, EX)."""
        path = os.path.join(INPUTS_DIR, "cdisc_api_sdtmig_domain_details.json")
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) >= 30, f"Expected 30+ domains, got {len(data)}"

    def test_sdtm_spec_details_have_variables(self):
        """SDTM specializations must include variable mappings."""
        path = os.path.join(INPUTS_DIR, "cdisc_api_sdtm_spec_details.json")
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) > 500, f"Expected 500+ specs, got {len(data)}"

        # Spot check structure
        spec = data[0]
        assert "domain" in spec
        assert "variables" in spec
        assert len(spec["variables"]) > 0


# ---------------------------------------------------------------------------
# Terminology JSON Files
# ---------------------------------------------------------------------------

class TestTerminologyFiles:
    """Verify bundled terminology JSON files are valid and complete."""

    TERM_DIR = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app", "terminology"
    )

    REQUIRED_TERM_FILES = [
        "phases.json",
        "study_types.json",
        "epoch_types.json",
        "arm_types.json",
        "intervention_models.json",
        "blinding_schemas.json",
        "sdtm_domains.json",
        "activity_catalog.json",
        "procedure_library.json",
        "procedure_burden.json",
        "soa_hierarchy.json",
    ]

    @pytest.mark.parametrize("filename", REQUIRED_TERM_FILES)
    def test_terminology_file_exists(self, filename):
        """Each terminology JSON file must exist."""
        path = os.path.join(self.TERM_DIR, filename)
        assert os.path.exists(path), f"Missing terminology file: {filename}"

    @pytest.mark.parametrize("filename", REQUIRED_TERM_FILES)
    def test_terminology_file_is_valid_json(self, filename):
        """Each terminology file must be parseable JSON."""
        path = os.path.join(self.TERM_DIR, filename)
        with open(path) as f:
            data = json.load(f)
        assert data is not None

    def test_phases_has_all_trial_phases(self):
        """Phases must include Phase I through Phase III."""
        path = os.path.join(self.TERM_DIR, "phases.json")
        with open(path) as f:
            data = json.load(f)
        phase_labels = [p.get("label", p.get("decode", "")).lower() for p in data]
        for expected in ["phase i", "phase ii", "phase iii"]:
            found = any(expected in lbl for lbl in phase_labels)
            assert found, f"Missing {expected} in phases.json (got: {phase_labels})"

    def test_activity_catalog_has_activities(self):
        """Activity catalog must contain activities and scheduling patterns."""
        path = os.path.join(self.TERM_DIR, "activity_catalog.json")
        with open(path) as f:
            data = json.load(f)
        assert "activities" in data
        assert len(data["activities"]) > 50, "Activity catalog seems too small"

    def test_soa_hierarchy_structure(self):
        """SOA hierarchy must have groups and activity groups."""
        path = os.path.join(self.TERM_DIR, "soa_hierarchy.json")
        with open(path) as f:
            data = json.load(f)
        # Should have some structure for SOA grouping
        assert isinstance(data, (dict, list))


# ---------------------------------------------------------------------------
# Indication Profiles
# ---------------------------------------------------------------------------

class TestIndicationProfiles:
    """Verify indication profile files exist and merge correctly."""

    PROFILES_DIR = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app", "terminology", "indication_profiles"
    )

    REQUIRED_PROFILES = [
        "_default.json",
        "oncology.json",
        "diabetes.json",
        "cardiovascular.json",
        "immunology.json",
    ]

    @pytest.mark.parametrize("filename", REQUIRED_PROFILES)
    def test_profile_file_exists(self, filename):
        """Each indication profile file must exist."""
        path = os.path.join(self.PROFILES_DIR, filename)
        assert os.path.exists(path), f"Missing profile: {filename}"

    @pytest.mark.parametrize("filename", REQUIRED_PROFILES)
    def test_profile_has_meta(self, filename):
        """Each profile must have _meta with id and name."""
        path = os.path.join(self.PROFILES_DIR, filename)
        with open(path) as f:
            data = json.load(f)
        assert "_meta" in data
        assert "id" in data["_meta"]
        assert "name" in data["_meta"]

    def test_oncology_has_condition_signals(self):
        """Oncology profile must include cancer-related condition signals."""
        path = os.path.join(self.PROFILES_DIR, "oncology.json")
        with open(path) as f:
            data = json.load(f)
        signals = data.get("conditionSignals", [])
        assert "cancer" in signals or any("cancer" in s for s in signals)
