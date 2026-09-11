from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.exceptions import AppException
from database.postgres.crud.approval import ApprovalCRUD
from database.postgres.crud.travel_request import TravelRequestCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import ApprovalDecision, TravelRequestStatus
from database.postgres.models.travel_approvals import TravelRequestApproval
from src.approvals.schemas import ApprovalDecideRequest, ApprovalInboxItem


class ApprovalService:
    """Travel-request approval inbox + decide."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.approvals = ApprovalCRUD(db)
        self.travel_requests = TravelRequestCRUD(db)

    def inbox(self, employee: Employee) -> list[ApprovalInboxItem]:
        rows = self.approvals.list_inbox_for_approver(employee.id)
        items: list[ApprovalInboxItem] = []
        for row in rows:
            trip = row.travel_request
            items.append(
                ApprovalInboxItem(
                    approval_id=row.id,
                    travel_request_id=trip.travel_request_id,
                    destination=trip.destination,
                    level=row.level,
                    role_required=row.role_required,
                    estimated_cost=str(trip.estimated_cost),
                    requester_employee_id=trip.employee_id,
                    created_at=row.created_at,
                )
            )
        return items

    def decide(
        self,
        employee: Employee,
        approval_id: int,
        payload: ApprovalDecideRequest,
    ) -> TravelRequestApproval:
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

        # Only the earliest pending level may act
        trip = row.travel_request
        active = next(
            (
                step
                for step in trip.approvals
                if step.decision == ApprovalDecision.PENDING
            ),
            None,
        )
        if active is None or active.id != row.id:
            raise AppException(
                status_code=422,
                sub_status_code="not_current_level",
                message="A prior approval level is still pending",
            )

        row.decision = payload.decision
        row.remarks = payload.remarks
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
            trip.status = TravelRequestStatus.DRAFT
            self.travel_requests.save(trip)
        elif payload.decision == ApprovalDecision.REJECTED:
            # Keep as closed-style terminal for request workflow
            trip.status = TravelRequestStatus.CLOSED
            self.travel_requests.save(trip)

        return row
