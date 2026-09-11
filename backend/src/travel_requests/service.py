from decimal import Decimal

from sqlalchemy.orm import Session

from core.exceptions import AppException
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.crud.travel_request import TravelRequestCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import ApprovalDecision, TravelRequestStatus
from database.postgres.models.travel_approvals import TravelRequestApproval
from database.postgres.models.travel_request import TravelRequest
from src.travel_requests.approval_matrix import build_request_approval_plan
from src.travel_requests.schemas import TravelRequestCreate
from core.config import logger


class TravelRequestService:
    """Orchestrates create / submit rules for travel requests."""

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
            # Attach the policy-driven approval chain before commit
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

        # Re-load with approvals for a complete response
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

    def _attach_approvals(
        self,
        travel_request: TravelRequest,
        employee: Employee,
        payload: TravelRequestCreate,
    ) -> None:
        # Build levels from estimated cost / international flag
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

        # If every step was skipped, surface a clear error (broken org chart)
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
