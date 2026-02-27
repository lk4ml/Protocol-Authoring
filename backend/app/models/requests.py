"""
Strict Pydantic request models for API endpoints.

These models serve as the validation + normalization layer at the API boundary.
They ensure incoming data conforms to the canonical schema before reaching
business logic or the database.

Key design decisions:
- Schedule instances use `activityIds` (list) + `defaultConditionId` as canonical form
- The normalizer accepts legacy `activityId` (singular) + `conditionality` for
  backward compatibility but converts them to canonical form
- UUIDs are used for all client-generated entity IDs
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Any, Optional
import uuid


def _new_uuid() -> str:
    return str(uuid.uuid4())


# -----------------------------------------------------------------------
# Schedule request models (canonical schema)
# -----------------------------------------------------------------------

class ScheduleInstanceRequest(BaseModel):
    """
    Canonical schedule instance.
    Accepts both legacy (activityId/conditionality) and canonical forms.
    """
    id: str = Field(default_factory=_new_uuid)
    activityIds: list[str] = []
    encounterId: str
    epochId: Optional[str] = None
    defaultConditionId: Optional[str] = "mandatory"

    # Legacy fields accepted for backward compat but normalized away
    activityId: Optional[str] = Field(default=None, exclude=True)
    conditionality: Optional[str] = Field(default=None, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        """Translate legacy frontend fields to canonical form."""
        if isinstance(data, dict):
            # activityId (singular) -> activityIds (list)
            if "activityId" in data and "activityIds" not in data:
                aid = data.pop("activityId")
                if aid:
                    data["activityIds"] = [aid]

            # conditionality -> defaultConditionId
            if "conditionality" in data and "defaultConditionId" not in data:
                data["defaultConditionId"] = data.pop("conditionality")
            elif "conditionality" in data:
                data.pop("conditionality")

        return data


class TimingRequest(BaseModel):
    id: str = Field(default_factory=_new_uuid)
    type: Optional[dict] = None
    description: Optional[str] = None
    value: Optional[str] = None
    valueLabel: Optional[str] = None
    relativeFromScheduledInstanceId: Optional[str] = None
    relativeToScheduledInstanceId: Optional[str] = None
    windowLower: Optional[str] = None
    windowUpper: Optional[str] = None
    windowLabel: Optional[str] = None


class ScheduleTimelineRequest(BaseModel):
    id: str = Field(default_factory=_new_uuid)
    name: str = "Main Timeline"
    description: Optional[str] = None
    mainTimeline: bool = True
    entryCondition: Optional[str] = None
    timings: list[TimingRequest] = []
    instances: list[ScheduleInstanceRequest] = []


class EncounterRequest(BaseModel):
    id: str = Field(default_factory=_new_uuid)
    name: str
    description: Optional[str] = None
    type: Optional[dict] = None
    environmentalSetting: Optional[dict] = None
    previousEncounterId: Optional[str] = None
    nextEncounterId: Optional[str] = None
    epochId: Optional[str] = None
    label: Optional[str] = None
    order: int = 0
    week: Optional[float] = None
    studyDay: Optional[int] = None
    visitWindow: Optional[str] = None


class ActivityRequest(BaseModel):
    """Activity with full metadata including hierarchy fields."""
    id: str = Field(default_factory=_new_uuid)
    name: str
    description: Optional[str] = None
    definedProcedures: list[dict] = []
    biomedicalConceptIds: list[str] = []
    previousActivityId: Optional[str] = None
    nextActivityId: Optional[str] = None
    categoryCode: Optional[str] = None
    sdtmDomain: Optional[str] = None
    # Hierarchy fields (used by frontend, preserved through round-trip)
    soaGroupId: Optional[str] = None
    activityGroupId: Optional[str] = None
    uiCategory: Optional[str] = None
    catalogId: Optional[str] = None
    source: Optional[str] = None
    cdiscCategories: list[str] = []
    therapeuticArea: Optional[str] = None
    nciCode: Optional[str] = None
    definition: Optional[str] = None
    synonyms: list[str] = []

    class Config:
        extra = "allow"


class SoaGroupRequest(BaseModel):
    id: str
    name: str
    order: int = 0
    colorBg: Optional[str] = None
    colorText: Optional[str] = None

    class Config:
        extra = "allow"


class ActivityGroupRequest(BaseModel):
    id: str
    name: str
    soaGroupId: str
    order: int = 0

    class Config:
        extra = "allow"


class ScheduleUpdateRequest(BaseModel):
    """
    Full schedule update payload.
    Validates and normalizes all schedule data at the API boundary.
    """
    encounters: Optional[list[EncounterRequest]] = None
    activities: Optional[list[ActivityRequest]] = None
    scheduleTimelines: Optional[list[ScheduleTimelineRequest]] = None
    soaGroups: Optional[list[SoaGroupRequest]] = None
    activityGroups: Optional[list[ActivityGroupRequest]] = None


# -----------------------------------------------------------------------
# Design request models
# -----------------------------------------------------------------------

class EligibilityCriterionRequest(BaseModel):
    id: str = Field(default_factory=_new_uuid)
    name: str = ""
    text: str
    category: str  # "inclusion" or "exclusion"
    order: int = 0


class EligibilityCriteriaRequest(BaseModel):
    inclusion: list[EligibilityCriterionRequest] = []
    exclusion: list[EligibilityCriterionRequest] = []


class StudyDesignUpdateRequest(BaseModel):
    """
    Full study design update payload.
    All fields are optional — only provided fields are updated (merge behavior).
    """
    studyArms: Optional[list[dict]] = None
    studyEpochs: Optional[list[dict]] = None
    studyCells: Optional[list[dict]] = None
    studyElements: Optional[list[dict]] = None
    studyMarkers: Optional[list[dict]] = None
    studyFlowOverrides: Optional[list[dict]] = None
    interventionModel: Optional[Any] = None
    blindingSchema: Optional[Any] = None
    eligibilityCriteria: Optional[Any] = None
    objectives: Optional[list[dict]] = None


# -----------------------------------------------------------------------
# Reference trial request models
# -----------------------------------------------------------------------

class ReferenceTrialRequest(BaseModel):
    """Validated reference trial from ClinicalTrials.gov."""
    nctId: str
    briefTitle: Optional[str] = None
    officialTitle: Optional[str] = None
    conditions: list[str] = []
    phase: Optional[Any] = None
    sponsor: Optional[str] = None
    enrollment: Optional[int] = None
    arms: list[dict] = []
    parsedAt: Optional[str] = None

    class Config:
        extra = "allow"

    @field_validator("nctId")
    @classmethod
    def validate_nct_id(cls, v):
        v = v.strip().upper()
        if not v.startswith("NCT"):
            raise ValueError("NCT ID must start with 'NCT'")
        return v
