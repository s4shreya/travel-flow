from decimal import Decimal

from sqlalchemy.orm import Session

from core.config import logger
from core.exceptions import AppException
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.crud.travel_request import TravelRequestCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ApprovalDecision,
    EmployeeRole,
    TravelRequestStatus,
)
from database.postgres.models.travel_approvals import TravelRequestApproval
from database.postgres.models.travel_request import TravelRequest
from src.travel_requests.advance_side_effects import seed_bookings_and_notify
from src.travel_requests.approval_matrix import build_request_approval_plan
from src.travel_requests.schemas import (
    AdvanceReleaseRequest,
    TravelRequestCreate,
    TravelRequestListItem,
    TravelRequestUpdate,
)


class TravelRequestService:
    """Orchestrates travel-request lifecycle rules."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.employees = EmployeeCRUD(db)
        self.travel_requests = TravelRequestCRUD(db)

    def create(
        self,
        employee: Employee,
        payload: TravelRequestCreate,
    ) -> TravelRequest:
        # Allocate business id from trip start year
        year = payload.start_date.year
        business_id = self.travel_requests.next_travel_request_id(year)

        status = (
            TravelRequestStatus.PENDING_APPROVAL
            if payload.submit
            else TravelRequestStatus.DRAFT
        )

        travel_request = TravelRequest(
            travel_request_id=business_id,
            employee_id=employee.id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            destination=payload.destination,
            purpose=payload.purpose,
            travel_category=payload.travel_category,
            travel_mode=payload.travel_mode,
            currency=payload.currency.upper(),
            estimated_heads=[
                head.model_dump(mode="json") for head in payload.estimated_heads
            ],
            estimated_cost=payload.estimated_cost,
            advance_requested=payload.advance_requested,
            advance_disbursed=Decimal("0"),
            status=status,
        )

        if payload.submit:
            self._attach_approvals(travel_request, employee, payload)

        try:
            created = self.travel_requests.create(travel_request)
        except Exception as exc:
            logger.error(
                f"Failed to create travel request for {employee.employee_code}: {exc}"
            )
            self.db.rollback()
            raise AppException(
                status_code=500,
                sub_status_code="travel_request_create_failed",
                message="Could not create travel request",
                details=str(exc),
            ) from exc

        loaded = self.travel_requests.get_by_business_id(created.travel_request_id)
        if loaded is None:
            raise AppException(
                status_code=500,
                sub_status_code="travel_request_create_failed",
                message="Travel request created but could not be reloaded",
            )

        logger.info(
            f"Created {loaded.travel_request_id} for {employee.employee_code} "
            f"status={loaded.status.value}"
        )
        return loaded

    def update(
        self,
        employee: Employee,
        travel_request_id: str,
        payload: TravelRequestUpdate,
    ) -> TravelRequest:
        row = self.travel_requests.get_by_business_id(travel_request_id)
        if row is None:
            raise AppException(
                status_code=404,
                sub_status_code="travel_request_not_found",
                message=f"Travel request not found: {travel_request_id}",
            )
        if row.employee_id != employee.id:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="Only the requester can edit this travel request",
            )
        if row.status != TravelRequestStatus.DRAFT:
            raise AppException(
                status_code=422,
                sub_status_code="not_editable",
                message="Only draft travel requests can be edited",
            )

        row.start_date = payload.start_date
        row.end_date = payload.end_date
        row.destination = payload.destination
        row.purpose = payload.purpose
        row.travel_category = payload.travel_category
        row.travel_mode = payload.travel_mode
        row.currency = payload.currency.upper()
        row.estimated_heads = [
            head.model_dump(mode="json") for head in payload.estimated_heads
        ]
        row.estimated_cost = payload.estimated_cost
        row.advance_requested = payload.advance_requested

        if payload.submit:
            # Rebuild approval chain from scratch on resubmit
            self.travel_requests.clear_approvals(row.id)
            row.approvals.clear()
            self._attach_approvals(row, employee, payload)
            row.status = TravelRequestStatus.PENDING_APPROVAL

        self.travel_requests.save(row)
        loaded = self.travel_requests.get_by_business_id(travel_request_id)
        assert loaded is not None
        return loaded

    def list_mine(self, employee: Employee) -> list[TravelRequest]:
        return self.travel_requests.list_for_employee(employee.id)

    def list_mine_items(self, employee: Employee) -> list[TravelRequestListItem]:
        rows = self.list_mine(employee)
        return [self._to_list_item(row) for row in rows]

    def list_awaiting_settlement_payment(self) -> list[TravelRequestListItem]:
        rows = self.travel_requests.list_awaiting_settlement_payment()
        return [self._to_list_item(row) for row in rows]

    def _to_list_item(self, row: TravelRequest) -> TravelRequestListItem:
        from src.travel_requests.track_progress import build_track_progress

        progress, pending, settle_status, payable, recoverable = build_track_progress(
            row, self.employees
        )
        return TravelRequestListItem(
            travel_request_id=row.travel_request_id,
            destination=row.destination,
            start_date=row.start_date,
            end_date=row.end_date,
            status=row.status,
            estimated_cost=row.estimated_cost,
            advance_requested=row.advance_requested,
            advance_disbursed=row.advance_disbursed,
            created_at=row.created_at,
            progress_label=progress,
            pending_with=pending,
            settlement_status=settle_status,
            settlement_amount_payable=payable,
            settlement_amount_recoverable=recoverable,
        )

    def get_for_viewer(
        self, employee: Employee, travel_request_id: str
    ) -> TravelRequest:
        row = self.travel_requests.get_by_business_id(travel_request_id)
        if row is None:
            raise AppException(
                status_code=404,
                sub_status_code="travel_request_not_found",
                message=f"Travel request not found: {travel_request_id}",
            )

        if not self._can_view(employee, row):
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="You cannot view this travel request yet",
            )
        return row

    def _can_view(self, employee: Employee, row: TravelRequest) -> bool:
        # Owner always
        if row.employee_id == employee.id:
            return True
        # Finance can view approved+ for advances / settlement
        if employee.role == EmployeeRole.FINANCE and row.status in {
            TravelRequestStatus.APPROVED,
            TravelRequestStatus.IN_SETTLEMENT,
            TravelRequestStatus.CLOSED,
        }:
            return True
        # Approver only when they are the current pending level on the request
        pending = next(
            (s for s in row.approvals if s.decision == ApprovalDecision.PENDING),
            None,
        )
        if pending and pending.approver_id == employee.id:
            return True
        # Approvers who already decided on this request may still open it
        if any(
            s.approver_id == employee.id and s.decision != ApprovalDecision.PENDING
            for s in row.approvals
        ):
            return True
        # Settlement approvers (current or past) may open the trip
        settlement = row.settlement
        if settlement is not None:
            for step in settlement.approvals:
                if step.approver_id != employee.id:
                    continue
                if step.decision != ApprovalDecision.PENDING:
                    return True
            settle_pending = next(
                (
                    s
                    for s in settlement.approvals
                    if s.decision == ApprovalDecision.PENDING
                ),
                None,
            )
            if settle_pending and settle_pending.approver_id == employee.id:
                return True
        return False

    def list_awaiting_advance(self) -> list[TravelRequest]:
        return self.travel_requests.list_awaiting_advance()

    def release_advance(
        self,
        travel_request_id: str,
        payload: AdvanceReleaseRequest,
    ) -> TravelRequest:
        row = self.travel_requests.get_by_business_id(travel_request_id)
        if row is None:
            raise AppException(
                status_code=404,
                sub_status_code="travel_request_not_found",
                message=f"Travel request not found: {travel_request_id}",
            )
        if row.status != TravelRequestStatus.APPROVED:
            raise AppException(
                status_code=422,
                sub_status_code="advance_not_allowed",
                message="Advance can only be released for approved requests",
            )
        remaining = row.advance_requested - row.advance_disbursed
        if payload.amount > remaining:
            raise AppException(
                status_code=422,
                sub_status_code="advance_exceeds_remaining",
                message=f"Amount exceeds remaining advance ({remaining})",
            )
        was_unfunded = row.advance_disbursed <= 0
        row.advance_disbursed = row.advance_disbursed + payload.amount
        logger.info(
            f"Advance {payload.amount} released on {row.travel_request_id} "
            f"ref={payload.reference.strip()}"
        )
        # First funds release → desk flight/hotel lines + two employee notifications
        if was_unfunded:
            employee = self.employees.get_by("id", row.employee_id)
            if employee is not None:
                seed_bookings_and_notify(
                    self.db,
                    row,
                    employee,
                    advance_amount=payload.amount,
                    reference=payload.reference.strip(),
                )
        return self.travel_requests.save(row)

    def _attach_approvals(
        self,
        travel_request: TravelRequest,
        employee: Employee,
        payload: TravelRequestCreate | TravelRequestUpdate,
    ) -> None:
        plan = build_request_approval_plan(
            self.employees,
            employee,
            payload.estimated_cost,
            payload.travel_category,
        )
        if not plan:
            raise AppException(
                status_code=422,
                sub_status_code="approval_chain_empty",
                message="Could not build an approval chain for this request",
            )

        for level, role, approver, skipped in plan:
            travel_request.approvals.append(
                TravelRequestApproval(
                    level=level,
                    role_required=role,
                    approver_id=(
                        None if skipped else (approver.id if approver else None)
                    ),
                    decision=(
                        ApprovalDecision.SKIPPED
                        if skipped
                        else ApprovalDecision.PENDING
                    ),
                )
            )

        pending = [
            step
            for step in travel_request.approvals
            if step.decision == ApprovalDecision.PENDING
        ]
        if not pending:
            raise AppException(
                status_code=422,
                sub_status_code="no_pending_approver",
                message=(
                    "No pending approver could be resolved for this employee. "
                    "Check the reporting chain."
                ),
            )
