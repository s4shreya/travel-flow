from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from core.approval_steps import first_pending
from core.capabilities import Capability, has_capability
from core.config import logger
from core.exceptions import AppException, forbidden, not_found
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.crud.travel_request import TravelRequestCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ApprovalDecision,
    TravelRequestStatus,
)
from database.postgres.models.travel_approvals import TravelRequestApproval
from database.postgres.models.travel_request import TravelRequest
from src.notifications.service import (
    add_notification,
    notify_advance_released,
    notify_current_approver,
    trip_href,
)
from src.settlements.totals import expense_split, recompute_settlement_totals
from src.travel_requests.approval_matrix import build_request_approval_plan
from src.travel_requests.schemas import (
    AdvanceReleaseRequest,
    FinanceRemarksRequest,
    TravelRequestCreate,
    TravelRequestListItem,
    TravelRequestUpdate,
)
from src.travel_requests.track_progress import build_track_progress

# Finance desk may open trips from approval onwards (advance + settlement)
_FINANCE_VISIBLE_STATUSES = frozenset(
    {
        TravelRequestStatus.APPROVED,
        TravelRequestStatus.IN_SETTLEMENT,
        TravelRequestStatus.CLOSED,
    }
)


def assert_not_own_trip(employee: Employee, trip: TravelRequest) -> None:
    """Finance / Admin cannot process money on their own trip (segregation of duties)."""
    if trip.employee_id == employee.id:
        raise forbidden("You cannot process your own travel request")


# Trip stages in which the employee can upload bills and file a settlement
SETTLEMENT_TRIP_STATUSES = frozenset(
    {TravelRequestStatus.APPROVED, TravelRequestStatus.IN_SETTLEMENT}
)


def advance_pending(trip: TravelRequest) -> bool:
    """Advance requested but nothing paid yet (Finance has not released or declined it)."""
    return trip.advance_requested > 0 and trip.advance_disbursed <= 0


def assert_settlement_open(trip: TravelRequest) -> None:
    """Bills and the settlement open once the trip is approved and the advance step is over."""
    if trip.status not in SETTLEMENT_TRIP_STATUSES:
        raise AppException(
            status_code=422,
            sub_status_code="settlement_not_allowed",
            message="Settlement is only available after the travel request is approved",
        )
    if advance_pending(trip):
        raise AppException(
            status_code=422,
            sub_status_code="advance_pending",
            message="Settlement opens once Finance releases or declines your advance",
        )


def to_list_item(row: TravelRequest) -> TravelRequestListItem:
    """Compact row for the track list and Finance queues."""
    progress, pending = build_track_progress(row)
    settlement = row.settlement
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
        employee_name=row.employee.name,
        progress_label=progress,
        pending_with=pending,
        settlement_status=settlement.status.value if settlement else None,
        settlement_amount_payable=settlement.amount_payable if settlement else None,
        settlement_amount_recoverable=settlement.amount_recoverable if settlement else None,
        # Actual spend = every expense line, whoever paid it
        settlement_actual_spend=(
            settlement.total_employee_paid + settlement.total_company_paid
            if settlement
            else None
        ),
        settlement_expense_split=expense_split(settlement) if settlement else None,
    )


class TravelRequestService:
    """Orchestrates travel-request lifecycle rules."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.employees = EmployeeCRUD(db)
        self.travel_requests = TravelRequestCRUD(db)

    def get_or_404(self, travel_request_id: str) -> TravelRequest:
        row = self.travel_requests.get_by_business_id(travel_request_id)
        if row is None:
            raise not_found(
                "travel_request_not_found", f"Travel request not found: {travel_request_id}"
            )
        return row

    def create(
        self,
        employee: Employee,
        payload: TravelRequestCreate,
    ) -> TravelRequest:
        # Allocate business id from trip start year
        year = (payload.start_date or date.today()).year
        business_id = self.travel_requests.next_travel_request_id(year)

        travel_request = TravelRequest(
            travel_request_id=business_id,
            employee_id=employee.id,
            advance_disbursed=Decimal("0"),
            status=TravelRequestStatus.DRAFT,
        )
        self._apply_payload(travel_request, employee, payload)

        # Persist; get_db rolls back on any failure
        created = self.travel_requests.save(travel_request)
        logger.info(
            f"Created {created.travel_request_id} for {employee.employee_code} "
            f"status={created.status.value}"
        )
        return self.get_or_404(created.travel_request_id)

    def update(
        self,
        employee: Employee,
        travel_request_id: str,
        payload: TravelRequestUpdate,
    ) -> TravelRequest:
        row = self.get_or_404(travel_request_id)
        if row.employee_id != employee.id:
            raise forbidden("Only the requester can edit this travel request")
        if row.status != TravelRequestStatus.DRAFT:
            raise AppException(
                status_code=422,
                sub_status_code="not_editable",
                message="Only draft travel requests can be edited",
            )

        if payload.submit:
            # Rebuild approval chain from scratch on resubmit
            self.travel_requests.clear_approvals(row)
        self._apply_payload(row, employee, payload)

        self.travel_requests.save(row)
        return self.get_or_404(travel_request_id)

    def list_mine_items(self, employee: Employee) -> list[TravelRequestListItem]:
        rows = self.travel_requests.list_for_employee(employee.id)
        return [to_list_item(row) for row in rows]

    def list_awaiting_settlement_payment(self) -> list[TravelRequestListItem]:
        rows = self.travel_requests.list_awaiting_settlement_payment()
        return [to_list_item(row) for row in rows]

    def list_awaiting_advance(self) -> list[TravelRequestListItem]:
        rows = self.travel_requests.list_awaiting_advance()
        return [to_list_item(row) for row in rows]

    def get_for_viewer(
        self, employee: Employee, travel_request_id: str
    ) -> TravelRequest:
        row = self.get_or_404(travel_request_id)
        if not self._can_view(employee, row):
            raise forbidden("You cannot view this travel request yet")
        return row

    @staticmethod
    def _can_view(employee: Employee, row: TravelRequest) -> bool:
        # Owner always
        if row.employee_id == employee.id:
            return True
        # Admin oversight: every request in the organisation
        if has_capability(employee.role, Capability.VIEW_ALL_REQUESTS):
            return True
        # Finance desk can view approved+ for advances / settlement
        if (
            has_capability(employee.role, Capability.RELEASE_FUNDS)
            and row.status in _FINANCE_VISIBLE_STATUSES
        ):
            return True
        # Approvers: anyone who already decided, or whoever holds the current pending level
        chains = [row.approvals] + ([row.settlement.approvals] if row.settlement else [])
        for chain in chains:
            if any(
                s.approver_id == employee.id and s.decision != ApprovalDecision.PENDING
                for s in chain
            ):
                return True
            pending = first_pending(chain)
            if pending and pending.approver_id == employee.id:
                return True
        return False

    def release_advance(
        self,
        finance: Employee,
        travel_request_id: str,
        payload: AdvanceReleaseRequest,
    ) -> TravelRequest:
        row = self.get_or_404(travel_request_id)
        assert_not_own_trip(finance, row)
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
        row.advance_disbursed += payload.amount
        logger.info(
            f"Advance {payload.amount} released on {row.travel_request_id} "
            f"by {finance.name} ref={payload.reference}"
        )
        # Keep the settlement draft's advance / balance in step
        if row.settlement is not None:
            recompute_settlement_totals(row.settlement, row)
        # Tell the requester (saved in the same commit)
        notify_advance_released(
            self.db, row, amount=payload.amount, reference=payload.reference
        )
        return self.travel_requests.save(row)

    def decline_advance(
        self,
        finance: Employee,
        travel_request_id: str,
        payload: FinanceRemarksRequest,
    ) -> TravelRequest:
        """Finance declines the unpaid advance; the trip stays approved and goes on to settlement."""
        row = self.get_or_404(travel_request_id)
        assert_not_own_trip(finance, row)
        remaining = row.advance_requested - row.advance_disbursed
        if row.status != TravelRequestStatus.APPROVED or remaining <= 0:
            raise AppException(
                status_code=422,
                sub_status_code="advance_not_pending",
                message="There is no pending advance to decline",
            )
        # Nothing more is owed: cap the advance at what was already paid
        row.advance_requested = row.advance_disbursed
        logger.info(
            f"Advance {remaining} declined on {row.travel_request_id} by {finance.name}"
        )
        # Tell the requester why (saved in the same commit)
        add_notification(
            self.db,
            employee_id=row.employee_id,
            title="Advance declined",
            body=(
                f"Finance declined ₹{remaining:,.2f} of the advance on {row.travel_request_id}. "
                f'Reason: "{payload.remarks}". You can still claim trip expenses in your settlement.'
            ),
            href=trip_href(row),
        )
        return self.travel_requests.save(row)

    def _apply_payload(
        self,
        travel_request: TravelRequest,
        employee: Employee,
        payload: TravelRequestCreate | TravelRequestUpdate,
    ) -> None:
        """Copy form fields onto the trip; on submit build the approval chain."""
        travel_request.start_date = payload.start_date
        travel_request.end_date = payload.end_date
        travel_request.destination = payload.destination
        travel_request.purpose = payload.purpose
        travel_request.travel_category = payload.travel_category
        travel_request.travel_mode = payload.travel_mode
        travel_request.currency = payload.currency
        travel_request.estimated_heads = [
            head.model_dump(mode="json") for head in payload.estimated_heads
        ]
        travel_request.estimated_cost = payload.estimated_cost
        travel_request.advance_requested = payload.advance_requested

        if payload.submit:
            self._attach_approvals(travel_request, employee, payload)
            travel_request.status = TravelRequestStatus.PENDING_APPROVAL

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

        for level, role, approver, skipped in plan:
            travel_request.approvals.append(
                TravelRequestApproval(
                    level=level,
                    role_required=role,
                    approver_id=None if skipped else approver.id,
                    decision=(
                        ApprovalDecision.SKIPPED
                        if skipped
                        else ApprovalDecision.PENDING
                    ),
                )
            )

        if first_pending(travel_request.approvals) is None:
            raise AppException(
                status_code=422,
                sub_status_code="no_pending_approver",
                message=(
                    "No pending approver could be resolved for this employee. "
                    "Check the reporting chain."
                ),
            )

        # Tell the first approver (saved in the same commit as the request)
        notify_current_approver(
            self.db,
            travel_request,
            travel_request.approvals,
            requester=employee,
            subject="Travel request",
            amount=payload.estimated_cost,
        )
