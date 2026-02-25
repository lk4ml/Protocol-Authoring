from pydantic import BaseModel, Field
from typing import Optional

from .common import Code, new_id


class EligibilityCriterion(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    text: str
    category: str  # "inclusion" or "exclusion"
    order: int = 0


class StudyDesignPopulation(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str = "Study Population"
    description: Optional[str] = None
    plannedNumberOfParticipants: Optional[int] = None
    criteria: list[EligibilityCriterion] = []
