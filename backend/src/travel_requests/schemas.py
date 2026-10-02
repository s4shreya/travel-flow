import re
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal

from pydantic import AliasPath, BaseModel, ConfigDict, Field, field_validator, model_validator

from core.expense_policy import MAX_ADVANCE_RATIO
from core.validators import (
    MAX_DAYS_IN_ADVANCE,
    MAX_ESTIMATE_HEADS,
    MAX_TRIP_DAYS,
    PAISA,
    PURPOSE_MAX,
    PURPOSE_MIN,
    Money,
    PositiveMoney,
    clean_text,
)
from database.postgres.models.enums import (
    ApprovalDecision,
    EmployeeRole,
    TravelCategory,
    TravelMode,
    TravelRequestStatus,
)


# Only employee-paid heads count toward the estimate and the advance
EMPLOYEE_PAID = "Employee"


class EstimatedHead(BaseModel):
    """One cost head on the travel request estimate (lodging, meals, …)."""

    head: str = Field(default="", max_length=128)
    basis: str = Field(default="", max_length=255)
    amount: Money = Decimal("0")
    borne_by: Literal["Company", "Employee"] = "Company"

    @field_validator("head", "basis")
    @classmethod
    def strip_head_fields(cls, value: str) -> str:
        return clean_text(value) or ""


class TravelRequestCreate(BaseModel):
    """Payload to create (and optionally submit) a travel request."""

    # Trip fields may be empty on a draft; submit checks them all
    start_date: date | None = None
    end_date: date | None = None
    destination: str | None = Field(default=None, max_length=255)
    purpose: str | None = Field(default=None, max_length=PURPOSE_MAX)
    travel_category: TravelCategory = TravelCategory.DOMESTIC_TIER_1
    travel_mode: TravelMode = TravelMode.FLIGHT
    currency: str = Field(default="INR", min_length=3, max_length=3)
    estimated_heads: list[EstimatedHead] = Field(
        default_factory=list, max_length=MAX_ESTIMATE_HEADS
    )
    estimated_cost: Money = Decimal("0")
    advance_requested: Money = Decimal("0")
    # When false, save as draft with no approval chain
    submit: bool = True

    @field_validator("destination")
    @classmethod
    def strip_destination(cls, value: str | None) -> str | None:
        # Normalize free-text fields (blank becomes None)
        return clean_text(value)

    @field_validator("purpose")
    @classmethod
    def strip_purpose(cls, value: str | None) -> str | None:
        # Keep line breaks in the purpose, only trim the ends
        return (value or "").strip() or None

    @field_validator("currency")
    @classmethod
    def upper_currency(cls, value: str) -> str:
        # ISO 4217 style code, e.g. INR
        if not value.isalpha():
            raise ValueError("must be a 3-letter code like INR")
        return value.upper()

    @model_validator(mode="after")
    def validate_request(self) -> "TravelRequestCreate":
        # Total is derived from the employee-paid cost heads, even on drafts
        heads_total = sum(
            (h.amount for h in self.estimated_heads if h.borne_by == EMPLOYEE_PAID),
            Decimal("0"),
        )
        if heads_total != self.estimated_cost:
            raise ValueError(
                f"Total estimated cost ({self.estimated_cost}) must equal the sum "
                f"of employee-paid cost heads ({heads_total})"
            )

        # Drafts save as they are; the full rules apply on submit
        if self.submit:
            self._check_ready_to_submit()
        return self

    def _check_ready_to_submit(self) -> None:
        # check every required field is filled in
        missing = [
            label
            for label, value in (
                ("from date", self.start_date),
                ("to date", self.end_date),
                ("destination", self.destination),
                ("purpose", self.purpose),
            )
            if not value
        ]
        if missing:
            raise ValueError(f"Add the {', '.join(missing)} before submitting")

        # check the text fields
        if len(self.destination) < 2 or not any(ch.isalpha() for ch in self.destination):
            raise ValueError("Enter a valid destination")
        if len(self.purpose) < PURPOSE_MIN:
            raise ValueError(f"Purpose must be at least {PURPOSE_MIN} characters")

        # Trip window must be coherent and in the future
        if self.end_date < self.start_date:
            raise ValueError("To date must be on or after the from date")
        if (self.end_date - self.start_date).days + 1 > MAX_TRIP_DAYS:
            raise ValueError(f"A single trip cannot exceed {MAX_TRIP_DAYS} days")
        if self.start_date < date.today():
            raise ValueError("From date cannot be in the past")
        if self.start_date > date.today() + timedelta(days=MAX_DAYS_IN_ADVANCE):
            raise ValueError(
                f"Trips can be planned at most {MAX_DAYS_IN_ADVANCE} days ahead"
            )

        # Every cost head must be complete
        if not self.estimated_heads:
            raise ValueError("Add at least one estimated cost head")
        for index, head in enumerate(self.estimated_heads, start=1):
            if not head.head or not head.basis or head.amount <= 0:
                raise ValueError(
                    f"Cost head #{index} needs a name, basis and an amount above zero"
                )
        if self.estimated_cost <= 0:
            raise ValueError("Add at least one cost head paid by the employee")

        # Advance ≤ 60% of the employee-paid estimate
        max_advance = (self.estimated_cost * MAX_ADVANCE_RATIO).quantize(PAISA)
        if self.advance_requested > max_advance:
            raise ValueError(
                f"Advance cannot exceed {MAX_ADVANCE_RATIO:.0%} of the employee-paid estimate "
                f"(max {max_advance})"
            )


class ApprovalStepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    level: int
    role_required: EmployeeRole
    approver_id: int | None
    # Read from the approver relationship; None while the level is unassigned
    approver_name: str | None = Field(default=None, validation_alias=AliasPath("approver", "name"))
    decision: ApprovalDecision
    remarks: str | None
    decided_at: datetime | None
    created_at: datetime


class TravelRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    travel_request_id: str
    employee_id: int
    # Requester's name, so approvers see who raised it
    employee_name: str = Field(validation_alias=AliasPath("employee", "name"))
    # Empty only on drafts
    start_date: date | None
    end_date: date | None
    destination: str | None
    purpose: str | None
    travel_category: TravelCategory
    travel_mode: TravelMode
    currency: str
    estimated_heads: list[dict[str, Any]]
    estimated_cost: Decimal
    advance_requested: Decimal
    advance_disbursed: Decimal
    status: TravelRequestStatus
    created_at: datetime
    updated_at: datetime
    approvals: list[ApprovalStepRead] = Field(default_factory=list)


class ExpenseSplitRead(BaseModel):
    """Settlement spend for one expense section."""

    section: str
    employee_paid: Decimal
    company_paid: Decimal
    disallowed: Decimal


class TravelRequestListItem(BaseModel):
    """Compact row for the track / finance queues."""

    model_config = ConfigDict(from_attributes=True)

    travel_request_id: str
    destination: str | None
    start_date: date | None
    end_date: date | None
    status: TravelRequestStatus
    estimated_cost: Decimal
    advance_requested: Decimal
    advance_disbursed: Decimal
    created_at: datetime
    # Requester, for Finance queues
    employee_name: str | None = None
    progress_label: str | None = None
    pending_with: str | None = None
    settlement_status: str | None = None
    settlement_amount_payable: Decimal | None = None
    settlement_amount_recoverable: Decimal | None = None
    # Dashboard analytics
    settlement_actual_spend: Decimal | None = None
    settlement_expense_split: list[ExpenseSplitRead] | None = None


class AdvanceReleaseRequest(BaseModel):
    amount: PositiveMoney
    # Bank / payment reference, e.g. ADV/TRQ-2026-0001
    reference: str = Field(..., min_length=3, max_length=64)

    @field_validator("reference")
    @classmethod
    def check_reference(cls, value: str) -> str:
        cleaned = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9/_.\- ]{2,63}", cleaned):
            raise ValueError(
                "use 3–64 letters, numbers, spaces or / _ . - characters"
            )
        return cleaned


class FinanceRemarksRequest(BaseModel):
    """Why Finance declined an advance or sent a settlement back."""

    remarks: str = Field(..., max_length=2000)

    @field_validator("remarks")
    @classmethod
    def check_remarks(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("add a short reason (at least 3 characters)")
        return cleaned


class TravelRequestUpdate(TravelRequestCreate):
    """Edit a draft travel request (same fields as create)."""

    pass

