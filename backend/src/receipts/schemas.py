from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

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


class ReceiptConfirmRequest(BaseModel):
    """Manual expense line linked to an uploaded receipt for this travel request."""

    section: ExpenseSection
    paid_by: PaidBy = PaidBy.EMPLOYEE
    amount: Decimal = Field(..., ge=0)

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

    @model_validator(mode="after")
    def validate_section_fields(self) -> "ReceiptConfirmRequest":
        # Same rules as settlement expense lines
        if self.section == ExpenseSection.LODGING:
            if not self.check_in or not self.check_out:
                raise ValueError("Lodging requires check-in and check-out dates")
            if self.check_out < self.check_in:
                raise ValueError("Check-out must be on or after check-in")
            if not (self.hotel_name and self.hotel_name.strip()):
                raise ValueError("Lodging requires hotel name")
            if not (self.city and self.city.strip()):
                raise ValueError("Lodging requires city")
        elif self.section == ExpenseSection.TRANSPORT:
            if not self.expense_date:
                raise ValueError("Transport requires a date")
            if not (self.from_location and self.from_location.strip()):
                raise ValueError("Transport requires from location")
            if not (self.to_location and self.to_location.strip()):
                raise ValueError("Transport requires to location")
            if not (self.mode and self.mode.strip()):
                raise ValueError("Transport requires mode")
        else:
            if not self.expense_date:
                raise ValueError("Other expense requires a date")
            if not (self.head and self.head.strip()):
                raise ValueError("Other expense requires a head")
        return self

    def to_expense(self, proof_ref: str) -> SettlementExpenseIn:
        return SettlementExpenseIn(
            section=self.section,
            amount=self.amount,
            paid_by=self.paid_by,
            proof_ref=proof_ref,
            check_in=self.check_in,
            check_out=self.check_out,
            hotel_name=self.hotel_name,
            city=self.city,
            expense_date=self.expense_date,
            expense_time=self.expense_time,
            from_location=self.from_location,
            to_location=self.to_location,
            mode=self.mode,
            head=self.head,
            description=self.description,
        )
