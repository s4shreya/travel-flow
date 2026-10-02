"""Organisation reporting."""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from database.postgres.crud.travel_request import TravelRequestCRUD
from database.postgres.models.enums import (
    APPROVED_SETTLEMENT_STATUSES,
    OPEN_TRIP_STATUSES,
    SUBMITTED_SETTLEMENT_STATUSES,
    ApprovalDecision,
    SettlementStatus,
    TravelRequestStatus,
)
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement
from src.reports.schemas import (
    AmountBreakdown,
    MonthlyPoint,
    ReportKpis,
    ReportResponse,
    ReportRow,
    StatusCount,
)
from src.settlements.totals import ZERO

TREND_MONTHS = 12
SECONDS_PER_DAY = 86400


def _submitted(trip: TravelRequest) -> TravelSettlement | None:
    """Settlement only once it has been submitted (drafts are not spend yet)."""
    settlement = trip.settlement
    if settlement and settlement.status in SUBMITTED_SETTLEMENT_STATUSES:
        return settlement
    return None


def _actual(settlement: TravelSettlement) -> Decimal:
    return settlement.total_employee_paid + settlement.total_company_paid


def _month_key(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def _last_months(end: date, count: int) -> list[str]:
    """YYYY-MM keys for `count` months ending at `end`, oldest first."""
    keys: list[str] = []
    year, month = end.year, end.month
    for _ in range(count):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(keys))


def _decision_days(trip: TravelRequest) -> float | None:
    """Days from first approval step to the final decision (None while still pending)."""
    steps = [s for s in trip.approvals if s.decision != ApprovalDecision.SKIPPED]
    if not steps or any(s.decision == ApprovalDecision.PENDING for s in steps):
        return None
    decided = [s.decided_at for s in steps if s.decided_at]
    if not decided:
        return None
    started = min(s.created_at for s in steps)
    return (max(decided) - started).total_seconds() / SECONDS_PER_DAY


class ReportService:
    def __init__(self, db: Session) -> None:
        self.trips = TravelRequestCRUD(db)

    def build(self, date_from: date | None, date_to: date | None) -> ReportResponse:
        # get every submitted trip in the period
        trips = self.trips.list_for_report(date_from, date_to)
        today = date.today()
        this_month = _month_key(today)

        # build the monthly trend buckets
        months = _last_months(date_to or today, TREND_MONTHS)
        monthly = {
            key: {"requests": 0, "claimed": ZERO, "approved": ZERO} for key in months
        }

        status_counts: dict[TravelRequestStatus, int] = defaultdict(int)
        by_department: dict[str, dict] = {}
        by_section: dict[str, dict] = {}
        by_category: dict[str, dict] = {}
        decision_days: list[float] = []
        totals = defaultdict(lambda: ZERO)
        pending_approvals = 0
        awaiting_count = 0
        rows: list[ReportRow] = []

        for trip in trips:
            settlement = _submitted(trip)
            actual = _actual(settlement) if settlement else ZERO
            status_counts[trip.status] += 1

            # handle request-level money
            totals["estimated"] += trip.estimated_cost
            totals["advances_disbursed"] += trip.advance_disbursed
            if trip.status == TravelRequestStatus.APPROVED:
                totals["advances_outstanding"] += max(
                    trip.advance_requested - trip.advance_disbursed, ZERO
                )
            if trip.status == TravelRequestStatus.PENDING_APPROVAL:
                pending_approvals += 1

            created_key = _month_key(trip.created_at.date())
            if created_key in monthly:
                monthly[created_key]["requests"] += 1

            # handle settlement-level money
            if settlement is not None:
                totals["claimed"] += settlement.total_employee_paid
                totals["company_paid"] += settlement.total_company_paid
                totals["disallowed"] += settlement.disallowed_total
                totals["actual"] += actual
                submitted_key = _month_key(
                    (settlement.submitted_at or trip.updated_at).date()
                )
                if submitted_key == this_month:
                    totals["spend_this_month"] += actual
                if submitted_key in monthly:
                    monthly[submitted_key]["claimed"] += settlement.total_employee_paid
                if settlement.status in APPROVED_SETTLEMENT_STATUSES:
                    totals["approved"] += settlement.net_reimbursable
                    if submitted_key in monthly:
                        monthly[submitted_key]["approved"] += settlement.net_reimbursable
                if settlement.status == SettlementStatus.FINANCE_REVIEW:
                    pending_approvals += 1
                if settlement.status == SettlementStatus.QUEUED_FOR_PAYMENT:
                    awaiting_count += 1
                    totals["awaiting_payment"] += settlement.amount_payable
                if settlement.status == SettlementStatus.RECOVERABLE:
                    totals["recoverable"] += settlement.amount_recoverable

                # where the money goes (expense category, every payer)
                for line in settlement.expenses:
                    slice_ = by_section.setdefault(
                        line.section.value, {"trips": set(), "actual": ZERO}
                    )
                    slice_["trips"].add(trip.id)
                    slice_["actual"] += line.amount

            # handle department / travel-category slices
            for bucket, label in (
                (by_department, trip.employee.department),
                (by_category, trip.travel_category.value),
            ):
                slice_ = bucket.setdefault(
                    label, {"requests": 0, "estimated": ZERO, "actual": ZERO}
                )
                slice_["requests"] += 1
                slice_["estimated"] += trip.estimated_cost
                slice_["actual"] += actual

            days = _decision_days(trip)
            if days is not None:
                decision_days.append(days)

            rows.append(
                ReportRow(
                    travel_request_id=trip.travel_request_id,
                    employee_name=trip.employee.name,
                    department=trip.employee.department,
                    destination=trip.destination,
                    travel_category=trip.travel_category,
                    start_date=trip.start_date,
                    end_date=trip.end_date,
                    status=trip.status,
                    settlement_status=trip.settlement.status.value if trip.settlement else None,
                    estimated_cost=trip.estimated_cost,
                    advance_disbursed=trip.advance_disbursed,
                    actual_spend=actual if settlement else None,
                    net_reimbursable=settlement.net_reimbursable if settlement else None,
                    disallowed=settlement.disallowed_total if settlement else None,
                )
            )

        # return the assembled report
        return ReportResponse(
            date_from=date_from,
            date_to=date_to,
            kpis=ReportKpis(
                total_requests=len(trips),
                open_requests=sum(status_counts.get(s, 0) for s in OPEN_TRIP_STATUSES),
                travellers=len({trip.employee_id for trip in trips}),
                estimated_total=totals["estimated"],
                claimed_total=totals["claimed"],
                approved_total=totals["approved"],
                actual_spend=totals["actual"],
                spend_this_month=totals["spend_this_month"],
                company_paid_total=totals["company_paid"],
                policy_savings=totals["disallowed"],
                advances_disbursed=totals["advances_disbursed"],
                advances_outstanding=totals["advances_outstanding"],
                pending_approvals=pending_approvals,
                awaiting_payment_count=awaiting_count,
                awaiting_payment_amount=totals["awaiting_payment"],
                recoverable_amount=totals["recoverable"],
                avg_days_to_decide=(
                    round(sum(decision_days) / len(decision_days), 1)
                    if decision_days
                    else None
                ),
            ),
            by_status=[
                StatusCount(status=status, count=count)
                for status, count in status_counts.items()
            ],
            monthly=[MonthlyPoint(month=key, **values) for key, values in monthly.items()],
            by_department=_breakdown(by_department),
            by_expense_category=[
                AmountBreakdown(
                    label=label,
                    requests=len(values["trips"]),
                    estimated=ZERO,
                    actual=values["actual"],
                )
                for label, values in sorted(
                    by_section.items(), key=lambda item: item[1]["actual"], reverse=True
                )
            ],
            by_travel_category=_breakdown(by_category),
            rows=rows,
        )


def _breakdown(bucket: dict[str, dict]) -> list[AmountBreakdown]:
    """Slices sorted by estimated spend, largest first."""
    return [
        AmountBreakdown(label=label, **values)
        for label, values in sorted(
            bucket.items(), key=lambda item: item[1]["estimated"], reverse=True
        )
    ]
