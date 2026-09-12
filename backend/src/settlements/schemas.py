from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from database.postgres.models.enums import (
    ApprovalDecision,
    EmployeeRole,
    ExpenseSection,
    PaidBy,
    SettlementStatus,
)


class SettlementExpenseIn(BaseModel):
    """One settlement line — lodging / transport / other fields as in the Excel form."""

    section: ExpenseSection
    amount: Decimal = Field(..., ge=0)
    paid_by: PaidBy = PaidBy.EMPLOYEE
    proof_ref: str | None = Field(default=None, max_length=128)

    # Lodging
    check_in: date | None = None
    check_out: date | None = None
    hotel_name: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=128)

    # Transport
    expense_date: date | None = None
    expense_time: time | None = None
    from_location: str | None = Field(default=None, max_length=255)
    to_location: str | None = Field(default=None, max_length=255)
    mode: str | None = Field(default=None, max_length=64)

    # Other
    head: str | None = Field(default=None, max_length=128)
    description: str | None = None

    @model_validator(mode="after")
    def validate_section_fields(self) -> "SettlementExpenseIn":
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


class SettlementExpenseRead(SettlementExpenseIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nights: int | None = None


class SettlementApprovalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    level: int
    role_required: EmployeeRole
    approver_id: int | None
    decision: ApprovalDecision
    remarks: str | None
    decided_at: datetime | None
    created_at: datetime


class SettlementSave(BaseModel):
    settlement_date: date | None = None
    expenses: list[SettlementExpenseIn] = Field(default_factory=list)
    # Summary: Less non-reimbursable / disallowed
    disallowed_total: Decimal = Field(default=Decimal("0"), ge=0)
    submit: bool = False

    @model_validator(mode="after")
    def require_lines_on_submit(self) -> "SettlementSave":
        if self.submit and not self.expenses:
            raise ValueError("Add at least one expense line before submitting")
        if self.submit:
            for line in self.expenses:
                if not line.proof_ref:
                    raise ValueError("Every claim line needs a proof reference")
        return self


class SettlementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    travel_request_id: str
    settlement_date: date | None
    status: SettlementStatus
    total_employee_paid: Decimal
    total_company_paid: Decimal
    disallowed_total: Decimal
    net_reimbursable: Decimal
    advance_applied: Decimal
    amount_payable: Decimal
    amount_recoverable: Decimal
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    expenses: list[SettlementExpenseRead] = Field(default_factory=list)
    approvals: list[SettlementApprovalRead] = Field(default_factory=list)
