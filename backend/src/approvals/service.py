from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from core.approval_steps import first_pending
from core.exceptions import AppException, forbidden, not_found
from database.postgres.crud.approval import ApprovalCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ApprovalDecision,
    SettlementStatus,
    TravelRequestStatus,
)
from database.postgres.models.travel_approvals import (
    TravelRequestApproval,
    TravelSettlementApproval,
)
from database.postgres.models.travel_request import TravelRequest
from src.approvals.schemas import (
    KIND_SETTLEMENT,
    KIND_TRAVEL_REQUEST,
    ApprovalDecideRequest,
    ApprovalInboxItem,
    ApprovalKind,
)
from src.notifications.service import (
    notify_current_approver,
    notify_requester_decision,
    settlement_href,
    trip_href,
)
from src.travel_requests.desk_bookings import seed_desk_bookings

# Decisions an approver can take on a pending step
_DECISIONS = frozenset(
    {ApprovalDecision.APPROVED, ApprovalDecision.RETURNED, ApprovalDecision.REJECTED}
)


def _is_current_pending(steps: list, step_id: int) -> bool:
    """True when this step is the earliest pending level (skips already decided)."""
    active = first_pending(steps)
    return active is not None and active.id == step_id


def _skip_remaining(steps: list) -> None:
    """A return / rejection ends the chain: later levels no longer need to act."""
    for step in steps:
        if step.decision == ApprovalDecision.PENDING:
            step.decision = ApprovalDecision.SKIPPED


def _check_step(row, employee: Employee, steps: list, *, open_: bool) -> None:
    """Shared guards: assigned approver, still pending, current level, item still open."""
    if row.approver_id != employee.id:
        raise forbidden("You are not the assigned approver for this step")
    if row.decision != ApprovalDecision.PENDING or not open_:
        raise AppException(
            status_code=422,
            sub_status_code="already_decided",
            message="This approval step is already decided",
        )
    if not _is_current_pending(steps, row.id):
        raise AppException(
            status_code=422,
            sub_status_code="not_current_level",
            message="A prior approval level is still pending",
        )


def _record(row, payload: ApprovalDecideRequest) -> None:
    row.decision = payload.decision
    row.remarks = payload.remarks.strip() if payload.remarks else None
    row.decided_at = datetime.now(timezone.utc)


def _inbox_item(
    kind: ApprovalKind, row, trip: TravelRequest, steps: list, amount: Decimal
) -> ApprovalInboxItem:
    """One inbox row for the approver's current step, with the whole chain."""
    return ApprovalInboxItem(
        kind=kind,
        approval_id=row.id,
        travel_request_id=trip.travel_request_id,
        destination=trip.destination,
        level=row.level,
        role_required=row.role_required,
        amount=str(amount),
        requester_employee_id=trip.employee_id,
        requester_name=trip.employee.name,
        created_at=row.created_at,
        approvals=steps,
    )


class ApprovalService:
    """Travel-request + settlement approval inbox and decide."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.approvals = ApprovalCRUD(db)

    def inbox(self, employee: Employee) -> list[ApprovalInboxItem]:
        items: list[ApprovalInboxItem] = []

        # Request approvals — only the current level of trips still awaiting approval
        for row in self.approvals.list_inbox_for_approver(employee.id):
            trip = row.travel_request
            if trip.status != TravelRequestStatus.PENDING_APPROVAL:
                continue
            if not _is_current_pending(trip.approvals, row.id):
                continue
            items.append(
                _inbox_item(KIND_TRAVEL_REQUEST, row, trip, trip.approvals, trip.estimated_cost)
            )

        # Settlement reviews — the Finance Controller's single step
        for row in self.approvals.list_settlement_inbox_for_approver(employee.id):
            settlement = row.settlement
            if settlement.status != SettlementStatus.FINANCE_REVIEW:
                continue
            if not _is_current_pending(settlement.approvals, row.id):
                continue
            items.append(
                _inbox_item(
                    KIND_SETTLEMENT,
                    row,
                    settlement.travel_request,
                    settlement.approvals,
                    settlement.net_reimbursable,
                )
            )

        items.sort(key=lambda item: item.created_at)
        return items

    def decide(
        self,
        employee: Employee,
        approval_id: int,
        payload: ApprovalDecideRequest,
    ) -> TravelRequestApproval | TravelSettlementApproval:
        if payload.decision not in _DECISIONS:
            raise AppException(
                status_code=422,
                sub_status_code="invalid_decision",
                message="Decision must be approved, returned, or rejected",
            )

        # Sending back or rejecting must say why
        if payload.decision != ApprovalDecision.APPROVED and not (
            payload.remarks and payload.remarks.strip()
        ):
            raise AppException(
                status_code=422,
                sub_status_code="remarks_required",
                message="Comments are required when sending back or rejecting",
            )

        if payload.kind == KIND_SETTLEMENT:
            return self._decide_settlement(employee, approval_id, payload)
        return self._decide_request(employee, approval_id, payload)

    def _decide_request(
        self,
        employee: Employee,
        approval_id: int,
        payload: ApprovalDecideRequest,
    ) -> TravelRequestApproval:
        row = self.approvals.get_by_id(approval_id)
        if row is None:
            raise not_found("approval_not_found", f"Approval not found: {approval_id}")
        trip = row.travel_request
        _check_step(
            row,
            employee,
            trip.approvals,
            open_=trip.status == TravelRequestStatus.PENDING_APPROVAL,
        )
        _record(row, payload)

        if payload.decision == ApprovalDecision.APPROVED:
            if first_pending(trip.approvals) is None:
                # Final level: trip approved, travel desk books travel + hotel
                trip.status = TravelRequestStatus.APPROVED
                seed_desk_bookings(self.db, trip, trip.employee)
        else:
            _skip_remaining(trip.approvals)
            # Returned → back to the employee's draft; rejected → closed
            trip.status = (
                TravelRequestStatus.DRAFT
                if payload.decision == ApprovalDecision.RETURNED
                else TravelRequestStatus.CLOSED
            )

        # Notify in the same commit as the decision
        self._notify_decision(
            employee,
            trip,
            trip.approvals,
            row,
            subject="Travel request",
            amount=trip.estimated_cost,
            next_steps={
                ApprovalDecision.APPROVED: (
                    "Finance will release your advance."
                    if trip.advance_requested > 0
                    else "File your settlement after the trip."
                ),
                ApprovalDecision.RETURNED: "Edit the draft and submit it again.",
            },
            href=trip_href(trip),
        )
        self.approvals.save(row)
        return row

    def _decide_settlement(
        self,
        employee: Employee,
        approval_id: int,
        payload: ApprovalDecideRequest,
    ) -> TravelSettlementApproval:
        row = self.approvals.get_settlement_by_id(approval_id)
        if row is None:
            raise not_found(
                "approval_not_found", f"Settlement approval not found: {approval_id}"
            )
        settlement = row.settlement
        _check_step(
            row,
            employee,
            settlement.approvals,
            open_=settlement.status == SettlementStatus.FINANCE_REVIEW,
        )
        _record(row, payload)

        trip = settlement.travel_request

        if payload.decision == ApprovalDecision.APPROVED:
            # Finance Controller's review is the only step: queue payout or payroll recovery
            if settlement.amount_recoverable > 0 and settlement.amount_payable <= 0:
                settlement.status = SettlementStatus.RECOVERABLE
            else:
                settlement.status = SettlementStatus.QUEUED_FOR_PAYMENT
        elif payload.decision == ApprovalDecision.RETURNED:
            settlement.status = SettlementStatus.RETURNED
            trip.status = TravelRequestStatus.APPROVED
        elif payload.decision == ApprovalDecision.REJECTED:
            settlement.status = SettlementStatus.RETURNED
            trip.status = TravelRequestStatus.CLOSED

        # Notify in the same commit as the decision
        self._notify_decision(
            employee,
            trip,
            settlement.approvals,
            row,
            subject="Settlement",
            amount=settlement.net_reimbursable,
            next_steps={
                ApprovalDecision.APPROVED: (
                    "The excess advance will be recovered from payroll."
                    if settlement.status == SettlementStatus.RECOVERABLE
                    else "It is queued for payment."
                ),
                ApprovalDecision.RETURNED: "Update your expenses and submit again.",
            },
            href=settlement_href(trip),
        )
        self.approvals.save(row)
        return row

    def _notify_decision(
        self,
        approver: Employee,
        trip: TravelRequest,
        steps: list,
        row,
        *,
        subject: str,
        amount: Decimal,
        next_steps: dict[ApprovalDecision, str],
        href: str,
    ) -> None:
        # Approved mid-chain: hand over to the next approver
        if row.decision == ApprovalDecision.APPROVED and first_pending(steps):
            notify_current_approver(
                self.db,
                trip,
                steps,
                requester=trip.employee,
                subject=subject,
                amount=amount,
            )
            return
        # Final approval, return or rejection: tell the requester
        notify_requester_decision(
            self.db,
            trip,
            subject=subject,
            decision=row.decision,
            approver=approver,
            remarks=row.remarks,
            next_step=next_steps.get(row.decision),
            href=href,
        )
