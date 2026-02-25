from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional

from .common import Code, new_id


class Procedure(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    procedureType: Optional[Code] = None


class Activity(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    definedProcedures: list[Procedure] = []
    biomedicalConceptIds: list[str] = []
    previousActivityId: Optional[str] = None
    nextActivityId: Optional[str] = None
    categoryCode: Optional[str] = None
    sdtmDomain: Optional[str] = None


class Encounter(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    type: Optional[Code] = None
    environmentalSetting: Optional[Code] = None
    previousEncounterId: Optional[str] = None
    nextEncounterId: Optional[str] = None
    epochId: Optional[str] = None
    label: Optional[str] = None
    order: int = 0


class Timing(BaseModel):
    id: str = Field(default_factory=new_id)
    type: Optional[Code] = None
    description: Optional[str] = None
    value: Optional[str] = None
    valueLabel: Optional[str] = None
    relativeFromScheduledInstanceId: Optional[str] = None
    relativeToScheduledInstanceId: Optional[str] = None
    windowLower: Optional[str] = None
    windowUpper: Optional[str] = None
    windowLabel: Optional[str] = None


class ScheduledActivityInstance(BaseModel):
    id: str = Field(default_factory=new_id)
    activityIds: list[str] = []
    encounterId: str
    epochId: Optional[str] = None
    defaultConditionId: Optional[str] = "mandatory"


class ScheduleTimeline(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str = "Main Timeline"
    description: Optional[str] = None
    mainTimeline: bool = True
    entryCondition: Optional[str] = None
    timings: list[Timing] = []
    instances: list[ScheduledActivityInstance] = []
