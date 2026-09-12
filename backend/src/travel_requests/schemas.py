from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from database.postgres.models.enums import (
    ApprovalDecision,
    EmployeeRole,
    TravelCategory,
    TravelMode,
    TravelRequestStatus,
)


class EstimatedHead(BaseModel):
    """One cost head on the travel request estimate (lodging, meals, …)."""

    head: str = Field(..., min_length=1, max_length=128)
    basis: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., ge=0)
    borne_by: Literal["Company", "Employee"] = "Company"

    @field_validator("head", "basis")
    @classmethod
    def strip_head_fields(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned


class TravelRequestCreate(BaseModel):
    """Payload to create (and optionally submit) a travel request."""

    start_date: date
    end_date: date
    destination: str = Field(..., min_length=1, max_length=255)
    purpose: str = Field(..., min_length=1)
    travel_category: TravelCategory = TravelCategory.DOMESTIC_TIER_1
    travel_mode: TravelMode = TravelMode.FLIGHT
    currency: str = Field(default="INR", min_length=3, max_length=8)
    estimated_heads: list[EstimatedHead] = Field(default_factory=list)
    estimated_cost: Decimal = Field(..., ge=0)
    advance_requested: Decimal = Field(default=Decimal("0"), ge=0)
    # When false, save as draft with no approval chain
    submit: bool = True

    @field_validator("destination", "purpose")
    @classmethod
    def strip_text(cls, value: str) -> str:
        # Normalize free-text fields
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned

    @model_validator(mode="after")
    def validate_dates_and_advance(self) -> "TravelRequestCreate":
        # Trip window must be coherent
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        # Advance ≤ 60% of total estimated cost
        max_advance = (self.estimated_cost * Decimal("0.60")).quantize(Decimal("0.01"))
        if self.advance_requested > max_advance:
            raise ValueError(
                f"advance_requested cannot exceed 60% of estimated_cost "
                f"(max {max_advance})"
            )
        return self


class ApprovalStepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    level: int
    role_required: EmployeeRole
    approver_id: int | None
    decision: ApprovalDecision
    remarks: str | None
    decided_at: datetime | None
    created_at: datetime


class TravelRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    travel_request_id: str
    employee_id: int
    start_date: date
    end_date: date
    destination: str
    purpose: str
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


class TravelRequestListItem(BaseModel):
    """Compact row for the track / finance queues."""

    model_config = ConfigDict(from_attributes=True)

    travel_request_id: str
    destination: str
    start_date: date
    end_date: date
    status: TravelRequestStatus
    estimated_cost: Decimal
    advance_requested: Decimal
    advance_disbursed: Decimal
    created_at: datetime
    progress_label: str | None = None
    pending_with: str | None = None
    settlement_status: str | None = None
    settlement_amount_payable: Decimal | None = None
    settlement_amount_recoverable: Decimal | None = None


class AdvanceReleaseRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    reference: str = Field(..., min_length=1, max_length=64)


class TravelRequestUpdate(TravelRequestCreate):
    """Edit a draft travel request (same fields as create)."""

    pass

