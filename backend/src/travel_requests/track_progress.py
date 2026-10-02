"""Human-readable progress labels for the track list."""

from decimal import Decimal

from core.approval_steps import first_pending
from database.postgres.models.enums import SettlementStatus, TravelRequestStatus
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement
from src.settlements.totals import ZERO

RETURNED_LABEL = "Settlement returned — revise and resubmit"
FINANCE_LABEL = "Finance"


def _pending_label(approvals: list) -> str | None:
    """Who the chain is waiting on, e.g. "Reporting Manager (Suresh)"."""
    step = first_pending(approvals)
    if step is None:
        return None
    role = step.role_required.value
    return f"{role} ({step.approver.name})" if step.approver else role


def _with_pending(label: str, pending_with: str | None) -> str:
    """Append who it is pending with, e.g. "… — Manager (Suresh)"."""
    return f"{label} — {pending_with}" if pending_with else label


def _paid_label(payable: Decimal | None, recoverable: Decimal | None) -> str:
    pay = payable or ZERO
    rec = recoverable or ZERO
    if rec > 0 and pay <= 0:
        return f"Closed — excess advance recovered via payroll (₹{rec})"
    if pay > 0:
        return f"Closed — settlement funds released (₹{pay})"
    return "Closed — settlement complete"


def _approved_progress(
    trip: TravelRequest, settlement: TravelSettlement | None
) -> tuple[str, str | None]:
    if trip.advance_requested > trip.advance_disbursed:
        return "Approved — awaiting advance release", FINANCE_LABEL
    if settlement and settlement.status == SettlementStatus.RETURNED:
        return RETURNED_LABEL, None
    if trip.advance_disbursed > 0:
        return "Approved — advance released", None
    return "Approved", None


def _settlement_progress(settlement: TravelSettlement) -> tuple[str, str | None]:
    status = settlement.status
    if status == SettlementStatus.DRAFT:
        return "Settlement draft", None
    if status == SettlementStatus.RETURNED:
        return RETURNED_LABEL, None
    # Submitted claims are reviewed by the Finance Controller
    if status == SettlementStatus.FINANCE_REVIEW:
        pending_with = _pending_label(settlement.approvals)
        return _with_pending("Settlement with Finance", pending_with), pending_with
    if status == SettlementStatus.QUEUED_FOR_PAYMENT:
        amount = settlement.amount_payable or ZERO
        return f"Settlement approved — awaiting fund release (₹{amount})", FINANCE_LABEL
    if status == SettlementStatus.RECOVERABLE:
        amount = settlement.amount_recoverable or ZERO
        return f"Excess advance — recover in next payroll (₹{amount})", FINANCE_LABEL
    return _paid_label(settlement.amount_payable, settlement.amount_recoverable), None


def _closed_label(settlement: TravelSettlement | None) -> str:
    if settlement is not None and settlement.status == SettlementStatus.PAID:
        return _paid_label(settlement.amount_payable, settlement.amount_recoverable)
    return "Closed"


def build_track_progress(trip: TravelRequest) -> tuple[str, str | None]:
    """(progress_label, pending_with) for the trip's current stage."""
    settlement = trip.settlement
    if trip.status == TravelRequestStatus.DRAFT:
        return "Draft", None
    if trip.status == TravelRequestStatus.PENDING_APPROVAL:
        pending_with = _pending_label(trip.approvals)
        return _with_pending("Request pending approval", pending_with), pending_with
    if trip.status == TravelRequestStatus.APPROVED:
        return _approved_progress(trip, settlement)
    if trip.status == TravelRequestStatus.IN_SETTLEMENT and settlement is not None:
        return _settlement_progress(settlement)
    if trip.status == TravelRequestStatus.CLOSED:
        return _closed_label(settlement), None
    return trip.status.value, None
