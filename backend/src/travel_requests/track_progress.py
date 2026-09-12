"""Human-readable progress labels for the track list."""

from __future__ import annotations

from decimal import Decimal

from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.models.enums import (
    ApprovalDecision,
    SettlementStatus,
    TravelRequestStatus,
)
from database.postgres.models.travel_request import TravelRequest


def _pending_label(approvals, employees: EmployeeCRUD) -> str | None:
    step = next(
        (s for s in approvals if s.decision == ApprovalDecision.PENDING),
        None,
    )
    if step is None:
        return None
    role = step.role_required.value if step.role_required else "Approver"
    if step.approver_id:
        person = employees.get_by("id", step.approver_id)
        if person is not None:
            return f"{role} ({person.name})"
    return role


def build_track_progress(
    trip: TravelRequest, employees: EmployeeCRUD
) -> tuple[str, str | None, str | None, Decimal | None, Decimal | None]:
    """
    Return (progress_label, pending_with, settlement_status, payable, recoverable).
    """
    settlement = trip.settlement
    settlement_status = settlement.status.value if settlement else None
    payable = settlement.amount_payable if settlement else None
    recoverable = settlement.amount_recoverable if settlement else None
    pending_with: str | None = None

    if trip.status == TravelRequestStatus.DRAFT:
        return "Draft", None, settlement_status, payable, recoverable

    if trip.status == TravelRequestStatus.PENDING_APPROVAL:
        pending_with = _pending_label(trip.approvals, employees)
        label = (
            f"Request pending approval — {pending_with}"
            if pending_with
            else "Request pending approval"
        )
        return label, pending_with, settlement_status, payable, recoverable

    if trip.status == TravelRequestStatus.APPROVED:
        if trip.advance_requested > 0 and trip.advance_disbursed <= 0:
            return (
                "Approved — awaiting advance release",
                "Finance",
                settlement_status,
                payable,
                recoverable,
            )
        if settlement and settlement.status == SettlementStatus.RETURNED:
            return (
                "Settlement returned — revise and resubmit",
                None,
                settlement_status,
                payable,
                recoverable,
            )
        if trip.advance_disbursed > 0:
            return (
                "Approved — advance released",
                None,
                settlement_status,
                payable,
                recoverable,
            )
        return "Approved", None, settlement_status, payable, recoverable

    if trip.status == TravelRequestStatus.IN_SETTLEMENT and settlement is not None:
        status = settlement.status
        if status in {SettlementStatus.DRAFT, SettlementStatus.SUBMITTED}:
            return (
                "Settlement draft",
                None,
                settlement_status,
                payable,
                recoverable,
            )
        if status == SettlementStatus.RETURNED:
            return (
                "Settlement returned — revise and resubmit",
                None,
                settlement_status,
                payable,
                recoverable,
            )
        if status in {
            SettlementStatus.IN_APPROVAL,
            SettlementStatus.FINANCE_REVIEW,
        }:
            pending_with = _pending_label(settlement.approvals, employees)
            if status == SettlementStatus.FINANCE_REVIEW:
                label = (
                    f"Settlement with Finance — {pending_with}"
                    if pending_with
                    else "Settlement with Finance"
                )
            else:
                label = (
                    f"Settlement pending approval — {pending_with}"
                    if pending_with
                    else "Settlement pending approval"
                )
            return label, pending_with, settlement_status, payable, recoverable
        if status == SettlementStatus.QUEUED_FOR_PAYMENT:
            amount = payable or Decimal("0")
            return (
                f"Settlement approved — awaiting fund release (₹{amount})",
                "Finance",
                settlement_status,
                payable,
                recoverable,
            )
        if status == SettlementStatus.RECOVERABLE:
            amount = recoverable or Decimal("0")
            return (
                f"Excess advance — recover in next payroll (₹{amount})",
                "Finance",
                settlement_status,
                payable,
                recoverable,
            )
        if status == SettlementStatus.PAID:
            return _paid_label(payable, recoverable), None, settlement_status, payable, recoverable
        return (
            f"In settlement ({status.value})",
            None,
            settlement_status,
            payable,
            recoverable,
        )

    if trip.status == TravelRequestStatus.CLOSED:
        if settlement is not None:
            if settlement.status == SettlementStatus.PAID:
                return (
                    _paid_label(payable, recoverable),
                    None,
                    settlement_status,
                    payable,
                    recoverable,
                )
            if settlement.status == SettlementStatus.RECOVERABLE:
                amount = recoverable or Decimal("0")
                return (
                    f"Closed — excess advance for payroll recovery (₹{amount})",
                    None,
                    settlement_status,
                    payable,
                    recoverable,
                )
        return "Closed", None, settlement_status, payable, recoverable

    return trip.status.value, None, settlement_status, payable, recoverable


def _paid_label(payable: Decimal | None, recoverable: Decimal | None) -> str:
    pay = payable or Decimal("0")
    rec = recoverable or Decimal("0")
    if rec > 0 and pay <= 0:
        return f"Closed — excess advance recovered via payroll (₹{rec})"
    if pay > 0:
        return f"Closed — settlement funds released (₹{pay})"
    return "Closed — settlement complete"
