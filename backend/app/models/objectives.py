from pydantic import BaseModel, Field
from typing import Optional

from .common import Code, new_id


class Endpoint(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    purpose: Optional[str] = None
    level: Optional[Code] = None


class Objective(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    level: Optional[Code] = None
    endpoints: list[Endpoint] = []


class Estimand(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: Optional[str] = None
    treatment: Optional[str] = None
    summaryMeasure: Optional[str] = None
    population: Optional[str] = None
    variableOfInterest: Optional[str] = None
    intercurrentEvents: list[str] = []
    objectiveId: Optional[str] = None
