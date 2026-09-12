from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.exceptions import AppException
from database.postgres.crud.approval import ApprovalCRUD
from database.postgres.crud.travel_request import TravelRequestCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ApprovalDecision,
    EmployeeRole,
    SettlementStatus,
    TravelRequestStatus,
)
from database.postgres.models.travel_approvals import TravelRequestApproval
from database.postgres.models.travel_settlement import TravelSettlement
from src.approvals.schemas import ApprovalDecideRequest, ApprovalInboxItem


def _is_current_pending(steps: list, step_id: int) -> bool:
    """True when this step is the earliest pending level (skips already decided)."""
    active = next(
        (s for s in steps if s.decision == ApprovalDecision.PENDING),
        None,
    )
    return active is not None and active.id == step_id


class ApprovalService:
    """Travel-request + settlement approval inbox and decide."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.approvals = ApprovalCRUD(db)
        self.travel_requests = TravelRequestCRUD(db)

    def inbox(self, employee: Employee) -> list[ApprovalInboxItem]:
        items: list[ApprovalInboxItem] = []

        # Request approvals — only the current level is visible
        for row in self.approvals.list_inbox_for_approver(employee.id):
            trip = row.travel_request
            if not _is_current_pending(trip.approvals, row.id):
                continue
            items.append(
                ApprovalInboxItem(
                    kind="travel_request",
                    approval_id=row.id,
                    travel_request_id=trip.travel_request_id,
                    destination=trip.destination,
                    level=row.level,
                    role_required=row.role_required,
                    amount=str(trip.estimated_cost),
                    requester_employee_id=trip.employee_id,
                    created_at=row.created_at,
                )
            )

        # Settlement approvals — only the current level is visible
        for row in self.approvals.list_settlement_inbox_for_approver(employee.id):
            settlement = row.settlement
            if not _is_current_pending(settlement.approvals, row.id):
                continue
            trip = settlement.travel_request
            items.append(
                ApprovalInboxItem(
                    kind="settlement",
                    approval_id=row.id,
                    travel_request_id=trip.travel_request_id,
                    destination=trip.destination,
                    level=row.level,
                    role_required=row.role_required,
                    amount=str(settlement.net_reimbursable),
                    requester_employee_id=trip.employee_id,
                    created_at=row.created_at,
                )
            )

        items.sort(key=lambda item: item.created_at)
        return items

    def decide(
        self,
        employee: Employee,
        approval_id: int,
        payload: ApprovalDecideRequest,
        *,
        kind: str = "travel_request",
    ) -> TravelRequestApproval | object:
        if payload.decision not in {
            ApprovalDecision.APPROVED,
            ApprovalDecision.RETURNED,
            ApprovalDecision.REJECTED,
        }:
            raise AppException(
                status_code=422,
                sub_status_code="invalid_decision",
                message="Decision must be approved, returned, or rejected",
            )

        if payload.decision == ApprovalDecision.RETURNED and not (
            payload.remarks and payload.remarks.strip()
        ):
            raise AppException(
                status_code=422,
                sub_status_code="remarks_required",
                message="Remarks are required when returning a request",
            )

        if kind == "settlement":
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
            raise AppException(
                status_code=404,
                sub_status_code="approval_not_found",
                message=f"Approval not found: {approval_id}",
            )
        if row.approver_id != employee.id:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="You are not the assigned approver for this step",
            )
        if row.decision != ApprovalDecision.PENDING:
            raise AppException(
                status_code=422,
                sub_status_code="already_decided",
                message="This approval step is already decided",
            )

        trip = row.travel_request
        if not _is_current_pending(trip.approvals, row.id):
            raise AppException(
                status_code=422,
                sub_status_code="not_current_level",
                message="A prior approval level is still pending",
            )

        row.decision = payload.decision
        row.remarks = payload.remarks.strip() if payload.remarks else None
        row.decided_at = datetime.now(timezone.utc)
        self.approvals.save(row)

        if payload.decision == ApprovalDecision.APPROVED:
            still_pending = any(
                step.decision == ApprovalDecision.PENDING for step in trip.approvals
            )
            if not still_pending:
                trip.status = TravelRequestStatus.APPROVED
                self.travel_requests.save(trip)
        elif payload.decision == ApprovalDecision.RETURNED:
            # Send back to employee with remarks on this step
            trip.status = TravelRequestStatus.DRAFT
            self.travel_requests.save(trip)
        elif payload.decision == ApprovalDecision.REJECTED:
            trip.status = TravelRequestStatus.CLOSED
            self.travel_requests.save(trip)

        return row

    def _decide_settlement(
        self,
        employee: Employee,
        approval_id: int,
        payload: ApprovalDecideRequest,
    ):
        row = self.approvals.get_settlement_by_id(approval_id)
        if row is None:
            raise AppException(
                status_code=404,
                sub_status_code="approval_not_found",
                message=f"Settlement approval not found: {approval_id}",
            )
        if row.approver_id != employee.id:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="You are not the assigned approver for this step",
            )
        if row.decision != ApprovalDecision.PENDING:
            raise AppException(
                status_code=422,
                sub_status_code="already_decided",
                message="This approval step is already decided",
            )

        settlement: TravelSettlement = row.settlement
        if not _is_current_pending(settlement.approvals, row.id):
            raise AppException(
                status_code=422,
                sub_status_code="not_current_level",
                message="A prior approval level is still pending",
            )

        row.decision = payload.decision
        row.remarks = payload.remarks.strip() if payload.remarks else None
        row.decided_at = datetime.now(timezone.utc)

        trip = settlement.travel_request

        if payload.decision == ApprovalDecision.APPROVED:
            still_pending = any(
                step.decision == ApprovalDecision.PENDING
                for step in settlement.approvals
            )
            if still_pending:
                # Move to finance review when next pending is Finance
                next_pending = next(
                    (
                        s
                        for s in settlement.approvals
                        if s.decision == ApprovalDecision.PENDING
                    ),
                    None,
                )
                if next_pending and next_pending.role_required == EmployeeRole.FINANCE:
                    settlement.status = SettlementStatus.FINANCE_REVIEW
            else:
                # Final step done (typically Finance)
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

        self.db.add(settlement)
        self.db.add(trip)
        self.approvals.save_settlement(row)
        return row
