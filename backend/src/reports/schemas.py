from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from database.postgres.models.enums import TravelCategory, TravelRequestStatus


class ReportKpis(BaseModel):
    """Headline organisation figures (all amounts INR)."""

    total_requests: int
    open_requests: int
    travellers: int
    estimated_total: Decimal
    # Claimed = employee-paid lines on submitted settlements; approved = net reimbursable after review
    claimed_total: Decimal
    approved_total: Decimal
    # Actual spend = every expense line on submitted settlements, whoever paid
    actual_spend: Decimal
    spend_this_month: Decimal
    company_paid_total: Decimal
    policy_savings: Decimal
    advances_disbursed: Decimal
    advances_outstanding: Decimal
    # Work waiting across the organisation
    pending_approvals: int
    awaiting_payment_count: int
    awaiting_payment_amount: Decimal
    recoverable_amount: Decimal
    avg_days_to_decide: float | None = None


class StatusCount(BaseModel):
    status: TravelRequestStatus
    count: int


class MonthlyPoint(BaseModel):
    month: str  # YYYY-MM
    requests: int
    claimed: Decimal
    approved: Decimal


class AmountBreakdown(BaseModel):
    """One slice of spend (department, expense category or travel category)."""

    label: str
    requests: int
    estimated: Decimal
    actual: Decimal


class ReportRow(BaseModel):
    """Flat trip row for the report table / CSV export."""

    travel_request_id: str
    employee_name: str
    department: str
    destination: str
    travel_category: TravelCategory
    start_date: date
    end_date: date
    status: TravelRequestStatus
    settlement_status: str | None = None
    estimated_cost: Decimal
    advance_disbursed: Decimal
    actual_spend: Decimal | None = None
    net_reimbursable: Decimal | None = None
    disallowed: Decimal | None = None


class ReportResponse(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    kpis: ReportKpis
    by_status: list[StatusCount]
    monthly: list[MonthlyPoint]
    by_department: list[AmountBreakdown]
    by_expense_category: list[AmountBreakdown]
    by_travel_category: list[AmountBreakdown]
    rows: list[ReportRow]
