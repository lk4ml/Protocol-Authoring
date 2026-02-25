from pydantic import BaseModel, Field
from typing import Optional
import uuid


def new_id() -> str:
    return str(uuid.uuid4())


class Code(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    codeSystem: str = "http://www.cdisc.org"
    codeSystemVersion: str = "2024-03-29"
    decode: str


class AliasCode(BaseModel):
    id: str = Field(default_factory=new_id)
    standardCode: Code


class Quantity(BaseModel):
    value: float
    unit: Optional[Code] = None


class TranslatedText(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    language: str = "en"
