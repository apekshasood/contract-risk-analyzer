from typing import Literal
from pydantic import BaseModel

class RiskClause(BaseModel):
    title: str
    type: Literal["risky", "missing"]
    page: int | None
    quote: str | None
    severity: Literal["High", "Medium", "Low"]
    issue: str
    plain_english: str
    rewrite: str

class ContractAudit(BaseModel):
    summary: str
    clauses: list[RiskClause]


class QuestionResponse(BaseModel):
    answer: str
    direct_quote: str
    is_in_contract: bool


class VerifiedClause(RiskClause):
    verified: bool | None  # None = missing clause, nothing to verify

class AuditResult(BaseModel):
    summary: str
    clauses: list[VerifiedClause]

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


Role = Literal["buyer", "seller", "landlord", "tenant"]
