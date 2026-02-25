from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional

from .common import Code, new_id


class Organization(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    organizationType: Code


class StudyIdentifier(BaseModel):
    id: str = Field(default_factory=new_id)
    studyIdentifier: str
    studyIdentifierScope: Organization


class StudyTitle(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    type: Code


class StudyVersion(BaseModel):
    id: str = Field(default_factory=new_id)
    versionIdentifier: str = "1.0"
    rationale: Optional[str] = None
    studyIdentifiers: list[StudyIdentifier] = []
    studyTitles: list[StudyTitle] = []
    studyPhase: Optional[Code] = None
    studyType: Optional[Code] = None
    studyDesigns: list = []  # list[StudyDesign] resolved at runtime


class Study(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    versions: list[StudyVersion] = []
