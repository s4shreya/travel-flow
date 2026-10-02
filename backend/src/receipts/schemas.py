from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from database.postgres.models.enums import ExpenseSection, PaidBy
from src.settlements.schemas import SettlementExpenseIn


class ReceiptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    travel_request_id: str
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime


class ReceiptConfirmRequest(SettlementExpenseIn):
    """Manual expense line linked to an uploaded receipt for this travel request."""

    def to_expense(self, proof_ref: str) -> SettlementExpenseIn:
        return SettlementExpenseIn.model_validate(
            {**self.model_dump(), "proof_ref": proof_ref}
        )


class ReceiptSuggestion(BaseModel):
    """Pre-filled expense fields from OCR — the employee reviews before saving."""

    section: ExpenseSection
    paid_by: PaidBy
    amount: Decimal | None = None
    check_in: date | None = None
    check_out: date | None = None
    hotel_name: str | None = None
    city: str | None = None
    expense_date: date | None = None
    expense_time: time | None = None
    from_location: str | None = None
    to_location: str | None = None
    mode: str | None = None
    head: str | None = None
    description: str | None = None
    disallowed_amount: Decimal = Decimal("0")
    disallow_reason: str | None = None


class PolicyFindingRead(BaseModel):
    level: Literal["info", "warning", "violation"]
    code: str
    message: str


EvidenceStatus = Literal["matched", "needs_review", "not_receipt"]


class ReceiptExtraction(BaseModel):
    receipt_id: int
    confidence: Literal["high", "medium", "low"]
    # Does the file look like a bill for this trip? note explains anything off
    evidence: EvidenceStatus = "matched"
    evidence_note: str | None = None
    merchant: str | None = None
    bill_number: str | None = None
    suggestion: ReceiptSuggestion
    findings: list[PolicyFindingRead] = Field(default_factory=list)
    # Raw OCR text so the employee can cross-check
    text: str = ""
