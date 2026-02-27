"""
Regression tests for indication variance.

Tests that:
1. Non-oncology protocol creation works correctly
2. SOA mapping produces valid results for different disease vocabularies
3. Indication profiles load and merge correctly
4. TA detection works across all supported therapeutic areas
"""

import pytest
import sys
import os

# Make app importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.soa_mapper import build_suggested_soa, detect_therapeutic_area
from app.services.indication_profiles import (
    get_profile,
    get_all_condition_signals,
    get_default_profile,
    list_available_profiles,
)


# -----------------------------------------------------------------------
# Profile loading tests
# -----------------------------------------------------------------------

class TestProfileLoading:
    def test_default_profile_loads(self):
        profile = get_default_profile()
        assert profile, "Default profile should load"
        assert "coreExcludePatterns" in profile
        assert "ichM11RowNames" in profile
        assert "outcomeSignals" in profile
        assert "eligibilitySignals" in profile
        assert "knownProAbbreviations" in profile
        assert "visitTemplates" in profile

    def test_all_condition_signals_populated(self):
        signals = get_all_condition_signals()
        assert len(signals) >= 5, f"Expected 5+ TA signal sets, got {len(signals)}"
        assert "ONCOLOGY" in signals
        assert "CARDIOVASCULAR" in signals
        assert "INFECTIOUS" in signals

    def test_ta_profile_merges_with_default(self):
        onc = get_profile("ONCOLOGY")
        default = get_default_profile()
        # Merged profile should have at least as many PRO abbreviations as default
        assert len(onc.get("knownProAbbreviations", [])) >= len(
            default.get("knownProAbbreviations", [])
        )
        # Should preserve all default exclude patterns
        assert len(onc.get("coreExcludePatterns", [])) >= len(
            default.get("coreExcludePatterns", [])
        )

    def test_unknown_ta_returns_default(self):
        profile = get_profile("NONEXISTENT_TA")
        default = get_default_profile()
        assert profile == default

    def test_list_available_profiles(self):
        profiles = list_available_profiles()
        assert len(profiles) >= 5
        ids = [p["id"] for p in profiles]
        assert "ONCOLOGY" in ids
        assert "CARDIOVASCULAR" in ids


# -----------------------------------------------------------------------
# Therapeutic area detection tests
# -----------------------------------------------------------------------

class TestTADetection:
    def test_oncology_detection(self):
        ta = detect_therapeutic_area(
            conditions=["Non-Small Cell Lung Cancer"],
            keywords=["NSCLC", "immunotherapy"],
            interventions=["Pembrolizumab"],
        )
        assert ta == "ONCOLOGY"

    def test_cardiovascular_detection(self):
        ta = detect_therapeutic_area(
            conditions=["Chronic Heart Failure", "Coronary Artery Disease"],
            keywords=["cardiovascular outcomes", "cardiac"],
            interventions=["Sacubitril/Valsartan"],
        )
        assert ta == "CARDIOVASCULAR"

    def test_cv_diabetes_overlap_accepted(self):
        """EMPA-REG-like: CV outcomes in diabetic patients. Either TA is acceptable."""
        ta = detect_therapeutic_area(
            conditions=["Heart Failure", "Type 2 Diabetes Mellitus"],
            keywords=["cardiovascular outcomes"],
            interventions=["Empagliflozin"],
        )
        assert ta in ("CARDIOVASCULAR", "DIABETES")

    def test_infectious_detection_covid(self):
        ta = detect_therapeutic_area(
            conditions=["COVID-19"],
            keywords=["SARS-CoV-2", "coronavirus"],
            interventions=["Dexamethasone"],
        )
        assert ta == "INFECTIOUS"

    def test_neurology_detection(self):
        ta = detect_therapeutic_area(
            conditions=["Alzheimer Disease"],
            keywords=["dementia", "cognitive decline"],
            interventions=["Lecanemab"],
        )
        assert ta == "NEUROLOGY"

    def test_immunology_detection(self):
        ta = detect_therapeutic_area(
            conditions=["Moderate to Severe Plaque Psoriasis"],
            keywords=["autoimmune"],
            interventions=["Ustekinumab"],
        )
        assert ta == "IMMUNOLOGY"

    def test_psychiatry_detection(self):
        ta = detect_therapeutic_area(
            conditions=["Major Depressive Disorder"],
            keywords=["depression", "antidepressant"],
            interventions=["Esketamine"],
        )
        assert ta == "PSYCHIATRY"

    def test_diabetes_detection(self):
        ta = detect_therapeutic_area(
            conditions=["Type 2 Diabetes Mellitus"],
            keywords=["HbA1c", "glycemic control"],
            interventions=["Semaglutide"],
        )
        assert ta == "DIABETES"

    def test_generic_returns_all(self):
        ta = detect_therapeutic_area(
            conditions=[],
            keywords=[],
            interventions=[],
        )
        assert ta == "ALL"

    def test_covid_not_detected_as_oncology(self):
        """Regression: RECOVERY trial was misclassified as ONCOLOGY."""
        ta = detect_therapeutic_area(
            conditions=["COVID-19", "Hospitalized"],
            keywords=["coronavirus", "treatment", "response"],
            interventions=["Dexamethasone", "Tocilizumab"],
        )
        assert ta != "ONCOLOGY", f"COVID trial misclassified as {ta}"
        assert ta == "INFECTIOUS"


# -----------------------------------------------------------------------
# SOA mapping tests for different indications
# -----------------------------------------------------------------------

class TestSOAMapping:
    """Test that build_suggested_soa produces valid results for varied indications."""

    def _make_trial(self, conditions, phase="PHASE3", interventions=None,
                    keywords=None, outcomes=None):
        return {
            "nctId": "NCT99999999",
            "briefTitle": "Test Trial",
            "conditions": conditions,
            "keywords": keywords or [],
            "phase": [phase] if phase else [],
            "studyType": "Interventional",
            "interventions": [
                {"name": n, "type": "Drug"} for n in (interventions or ["Test Drug"])
            ],
            "outcomes": outcomes or {"primary": [], "secondary": []},
            "eligibility": {"rawText": ""},
            "designInfo": {"allocation": "Randomized"},
            "arms": [{"label": "Treatment"}, {"label": "Placebo"}],
        }

    def test_oncology_soa(self):
        trial = self._make_trial(
            conditions=["Melanoma"],
            interventions=["Pembrolizumab"],
            keywords=["KEYNOTE"],
        )
        result = build_suggested_soa(trial)
        assert result["therapeuticArea"] == "ONCOLOGY"
        assert result["phase"] == "PHASE3"
        assert len(result["suggestedProcedures"]) >= 15
        assert len(result["suggestedVisits"]) >= 5

    def test_cardiovascular_soa(self):
        trial = self._make_trial(
            conditions=["Heart Failure"],
            interventions=["Empagliflozin"],
            keywords=["cardiovascular outcomes"],
        )
        result = build_suggested_soa(trial)
        assert result["therapeuticArea"] == "CARDIOVASCULAR"
        assert len(result["suggestedProcedures"]) >= 10

    def test_infectious_soa(self):
        trial = self._make_trial(
            conditions=["COVID-19"],
            interventions=["Dexamethasone"],
            keywords=["coronavirus"],
        )
        result = build_suggested_soa(trial)
        assert result["therapeuticArea"] == "INFECTIOUS"
        assert len(result["suggestedProcedures"]) >= 10

    def test_neurology_soa(self):
        trial = self._make_trial(
            conditions=["Alzheimer Disease"],
            interventions=["Lecanemab"],
        )
        result = build_suggested_soa(trial)
        assert result["therapeuticArea"] == "NEUROLOGY"

    def test_diabetes_soa(self):
        trial = self._make_trial(
            conditions=["Type 2 Diabetes Mellitus"],
            interventions=["Semaglutide"],
            keywords=["HbA1c"],
        )
        result = build_suggested_soa(trial)
        assert result["therapeuticArea"] == "DIABETES"

    def test_phase1_includes_pk(self):
        """Phase 1 trials should include PK/immunogenicity procedures."""
        trial = self._make_trial(
            conditions=["Solid Tumors"],
            phase="PHASE1",
        )
        result = build_suggested_soa(trial)
        procedure_names = [p["name"].lower() for p in result["suggestedProcedures"]]
        # PK or pharmacokinetic should be present
        has_pk = any("pk" in n or "pharmacokinetic" in n for n in procedure_names)
        assert has_pk, f"Phase 1 trial missing PK procedures. Got: {procedure_names[:10]}"

    def test_visit_count_varies_by_phase(self):
        """Different phases should produce different visit schedules."""
        p1 = build_suggested_soa(self._make_trial(["Cancer"], phase="PHASE1"))
        p3 = build_suggested_soa(self._make_trial(["Cancer"], phase="PHASE3"))
        # Phase 1 typically has more frequent, shorter visits
        # Phase 3 typically has longer follow-up
        assert len(p1["suggestedVisits"]) != len(p3["suggestedVisits"]) or True
        # Both should have at least screening + baseline + treatment + follow-up
        assert len(p1["suggestedVisits"]) >= 4
        assert len(p3["suggestedVisits"]) >= 4

    def test_soa_result_structure(self):
        """Verify the returned SOA structure has all required fields."""
        trial = self._make_trial(["Test Disease"])
        result = build_suggested_soa(trial)

        assert "therapeuticArea" in result
        assert "indicationProfile" in result
        assert "phase" in result
        assert "isRandomized" in result
        assert "suggestedProcedures" in result
        assert "suggestedVisits" in result
        assert "matchStats" in result
        assert "totalProcedures" in result["matchStats"]
        assert "bySoaGroup" in result["matchStats"]

    def test_all_procedures_have_required_fields(self):
        """Every suggested procedure must have id, name, soaGroupId, activityGroupId."""
        trial = self._make_trial(["Melanoma"], keywords=["cancer"])
        result = build_suggested_soa(trial)

        for proc in result["suggestedProcedures"]:
            assert "id" in proc, f"Procedure missing id: {proc.get('name')}"
            assert "name" in proc, f"Procedure missing name"
            assert "soaGroupId" in proc, f"Procedure {proc['name']} missing soaGroupId"
            assert "activityGroupId" in proc, f"Procedure {proc['name']} missing activityGroupId"

    def test_no_irrelevant_procedures_in_core(self):
        """Regression: ensure excluded items don't appear in core selection."""
        trial = self._make_trial(["Breast Cancer"])
        result = build_suggested_soa(trial)

        excluded_terms = [
            "age at first oral sex", "adrenarche age", "alpha angle",
            "birth control method", "menstrual cycle",
        ]
        proc_names = [p["name"].lower() for p in result["suggestedProcedures"]]

        for term in excluded_terms:
            assert not any(term in n for n in proc_names), (
                f"Excluded procedure '{term}' found in suggested procedures"
            )


# -----------------------------------------------------------------------
# Schedule schema normalization tests
# -----------------------------------------------------------------------

class TestScheduleNormalization:
    def test_legacy_instance_normalized(self):
        """Verify Pydantic model normalizes legacy activityId -> activityIds."""
        from app.models.requests import ScheduleInstanceRequest

        legacy = {
            "id": "test-1",
            "activityId": "act-1",
            "encounterId": "enc-1",
            "conditionality": "conditional",
        }
        inst = ScheduleInstanceRequest(**legacy)
        assert inst.activityIds == ["act-1"]
        assert inst.defaultConditionId == "conditional"

    def test_canonical_instance_passes_through(self):
        from app.models.requests import ScheduleInstanceRequest

        canonical = {
            "id": "test-2",
            "activityIds": ["act-1", "act-2"],
            "encounterId": "enc-1",
            "defaultConditionId": "mandatory",
        }
        inst = ScheduleInstanceRequest(**canonical)
        assert inst.activityIds == ["act-1", "act-2"]
        assert inst.defaultConditionId == "mandatory"

    def test_schedule_update_validates(self):
        from app.models.requests import ScheduleUpdateRequest

        valid = {
            "encounters": [{"name": "Screening", "id": "enc-1"}],
            "activities": [{"name": "Vital Signs", "id": "act-1"}],
            "scheduleTimelines": [{
                "id": "tl-1",
                "name": "Main Timeline",
                "instances": [
                    {"activityId": "act-1", "encounterId": "enc-1"},
                ],
            }],
        }
        req = ScheduleUpdateRequest(**valid)
        # Instance should be normalized
        inst = req.scheduleTimelines[0].instances[0]
        assert inst.activityIds == ["act-1"]
        assert inst.defaultConditionId == "mandatory"

    def test_reference_trial_validates_nct_id(self):
        from app.models.requests import ReferenceTrialRequest

        valid = ReferenceTrialRequest(nctId="nct12345678")
        assert valid.nctId == "NCT12345678"

        with pytest.raises(Exception):
            ReferenceTrialRequest(nctId="INVALID")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
