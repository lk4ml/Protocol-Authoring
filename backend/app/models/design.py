from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional

from .common import Code, new_id


class StudyArm(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    type: Optional[Code] = None
    order: int = 0


class StudyEpoch(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    type: Optional[Code] = None
    previousEpochId: Optional[str] = None
    nextEpochId: Optional[str] = None
    order: int = 0


class StudyElement(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    transitionStartRule: Optional[str] = None
    transitionEndRule: Optional[str] = None
    studyInterventionIds: list[str] = []


class StudyCell(BaseModel):
    id: str = Field(default_factory=new_id)
    armId: str
    epochId: str
    elementIds: list[str] = []


class Indication(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    codes: list[Code] = []


class InvestigationalIntervention(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    codes: list[Code] = []
    administrationRoute: Optional[Code] = None
    formulation: Optional[Code] = None


class StudyDesign(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str = "Main Design"
    description: Optional[str] = None
    studyType: Optional[Code] = None
    interventionModel: Optional[Code] = None
    trialIntentTypes: list[Code] = []
    trialTypes: list[Code] = []
    therapeuticAreas: list[Code] = []
    studyArms: list[StudyArm] = []
    studyEpochs: list[StudyEpoch] = []
    studyCells: list[StudyCell] = []
    studyElements: list[StudyElement] = []
    encounters: list = []         # list[Encounter]
    activities: list = []         # list[Activity]
    scheduleTimelines: list = []  # list[ScheduleTimeline]
    objectives: list = []         # list[Objective]
    estimands: list = []          # list[Estimand]
    population: Optional[dict] = None
    indications: list[Indication] = []
    studyInterventions: list[InvestigationalIntervention] = []
    biomedicalConcepts: list = []
    eligibilityCriteria: list = []
    blindingSchema: Optional[Code] = None
    sampleSize: Optional[int] = None
