from decimal import Decimal

from sqlalchemy.orm import Session

from core.approval_steps import first_pending
from database.postgres.models.employee import Employee
from database.postgres.models.enums import ApprovalDecision
from database.postgres.models.notification import AppNotification
from database.postgres.models.travel_request import TravelRequest

# What the requester is told for each decision
_OUTCOMES = {
    ApprovalDecision.APPROVED: "approved",
    ApprovalDecision.RETURNED: "returned for changes",
    ApprovalDecision.REJECTED: "rejected",
}


def trip_href(trip: TravelRequest) -> str:
    return f"/travel-requests/{trip.travel_request_id}"


def settlement_href(trip: TravelRequest) -> str:
    return f"/travel-requests/{trip.travel_request_id}/settlement"


def review_href(trip: TravelRequest) -> str:
    # Approvers review under Approvals, not the requester's pages
    return f"/approvals/{trip.travel_request_id}"


def add_notification(
    db: Session,
    *,
    employee_id: int,
    title: str,
    body: str,
    href: str,
) -> None:
    db.add(
        AppNotification(
            employee_id=employee_id,
            title=title,
            body=body,
            href=href,
            read=False,
        )
    )


def notify_current_approver(
    db: Session,
    trip: TravelRequest,
    steps: list,
    *,
    requester: Employee,
    subject: str,
    amount: Decimal,
) -> None:
    """Tell whoever is now first in the approval chain that it is their turn."""
    step = first_pending(steps)
    # Chain finished, or this level has no resolved approver
    if step is None or step.approver_id is None:
        return
    add_notification(
        db,
        employee_id=step.approver_id,
        title=f"{subject} awaiting your approval",
        body=(
            f"{requester.name} · {trip.travel_request_id} to {trip.destination} "
            f"· ₹{amount:,.2f}"
        ),
        href=review_href(trip),
    )


def notify_requester_decision(
    db: Session,
    trip: TravelRequest,
    *,
    subject: str,
    decision: ApprovalDecision,
    approver: Employee,
    remarks: str | None,
    next_step: str | None,
    href: str,
) -> None:
    """Tell the requester their request or settlement was approved, returned or rejected."""
    outcome = _OUTCOMES[decision]
    body = f"{trip.travel_request_id} was {outcome} by {approver.name}."
    if remarks:
        body += f' Remarks: "{remarks}".'
    if next_step:
        body += f" {next_step}"
    add_notification(
        db,
        employee_id=trip.employee_id,
        title=f"{subject} {outcome}",
        body=body,
        href=href,
    )


def notify_advance_released(
    db: Session, trip: TravelRequest, *, amount: Decimal, reference: str
) -> None:
    """Tell the requester Finance paid (part of) their travel advance."""
    add_notification(
        db,
        employee_id=trip.employee_id,
        title="Advance released",
        body=f"Finance released advance ₹{amount:,.2f} ({reference}) for {trip.travel_request_id}.",
        href=trip_href(trip),
    )


def notify_settlement_closed(
    db: Session,
    trip: TravelRequest,
    *,
    amount_payable: Decimal,
    amount_recoverable: Decimal,
) -> None:
    """Tell the requester Finance paid the settlement or noted the payroll recovery."""
    if amount_recoverable > 0 and amount_payable <= 0:
        title = "Settlement recovery noted"
        body = (
            f"Finance closed settlement for {trip.travel_request_id}. "
            f"Excess advance ₹{amount_recoverable:,.2f} will be recovered from payroll."
        )
    else:
        title = "Settlement payment released"
        body = (
            f"Finance released settlement funds ₹{amount_payable:,.2f} for "
            f"{trip.travel_request_id}. Your travel request is now closed."
        )
    add_notification(
        db,
        employee_id=trip.employee_id,
        title=title,
        body=body,
        href=settlement_href(trip),
    )
