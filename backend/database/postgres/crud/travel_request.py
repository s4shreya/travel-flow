from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from database.postgres.models.enums import (
    OPEN_TRIP_STATUSES,
    PAYMENT_DUE_STATUSES,
    TravelRequestStatus,
)
from database.postgres.models.travel_approvals import (
    TravelRequestApproval,
    TravelSettlementApproval,
)
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement

# Business id format: TRQ-<trip start year>-<4-digit sequence>
TRAVEL_REQUEST_ID_PREFIX = "TRQ"

# Everything a list row needs: requester, approval steps (+ approvers), settlement + its lines
_LIST_ITEM_OPTIONS = (
    selectinload(TravelRequest.employee),
    selectinload(TravelRequest.approvals).selectinload(TravelRequestApproval.approver),
    selectinload(TravelRequest.settlement)
    .selectinload(TravelSettlement.approvals)
    .selectinload(TravelSettlementApproval.approver),
    selectinload(TravelRequest.settlement).selectinload(TravelSettlement.expenses),
)


class TravelRequestCRUD:
    """Persistence helpers for travel requests."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def next_travel_request_id(self, year: int) -> str:
        # Allocate TRQ-YYYY-NNNN from the highest existing id for that year
        prefix = f"{TRAVEL_REQUEST_ID_PREFIX}-{year}-"
        stmt = select(func.max(TravelRequest.travel_request_id)).where(
            TravelRequest.travel_request_id.like(f"{prefix}%")
        )
        latest = self.db.execute(stmt).scalar_one_or_none()
        if latest is None:
            seq = 1
        else:
            seq = int(latest.rsplit("-", maxsplit=1)[-1]) + 1
        return f"{prefix}{seq:04d}"

    def get_by_business_id(self, travel_request_id: str) -> TravelRequest | None:
        # Load request with approval steps for API responses
        stmt = (
            select(TravelRequest)
            .where(TravelRequest.travel_request_id == travel_request_id)
            .options(
                selectinload(TravelRequest.employee),
                selectinload(TravelRequest.approvals),
                selectinload(TravelRequest.receipts),
                selectinload(TravelRequest.settlement).selectinload(
                    TravelSettlement.approvals
                ),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_employee(self, employee_id: int) -> list[TravelRequest]:
        # Track page: my trips, newest first — include settlement for progress
        # and its expense lines for the dashboard spend breakdown
        stmt = (
            select(TravelRequest)
            .where(TravelRequest.employee_id == employee_id)
            .options(*_LIST_ITEM_OPTIONS)
            .order_by(TravelRequest.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_awaiting_settlement_payment(self) -> list[TravelRequest]:
        # Finance queue: approved settlements waiting for fund release / recovery note
        stmt = (
            select(TravelRequest)
            .join(TravelSettlement)
            .where(TravelSettlement.status.in_(PAYMENT_DUE_STATUSES))
            .options(*_LIST_ITEM_OPTIONS)
            .order_by(TravelRequest.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_awaiting_advance(self) -> list[TravelRequest]:
        # Finance queue: approved trips still owed an advance
        stmt = (
            select(TravelRequest)
            .where(
                TravelRequest.status == TravelRequestStatus.APPROVED,
                TravelRequest.advance_requested > TravelRequest.advance_disbursed,
            )
            .options(*_LIST_ITEM_OPTIONS)
            .order_by(TravelRequest.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_for_report(
        self, date_from: date | None = None, date_to: date | None = None
    ) -> list[TravelRequest]:
        # Reports: every non-draft trip (optionally by the date it was raised) with requester,
        # approval steps and settlement lines for org-wide aggregates
        stmt = (
            select(TravelRequest)
            .where(TravelRequest.status != TravelRequestStatus.DRAFT)
            .options(*_LIST_ITEM_OPTIONS)
            .order_by(TravelRequest.created_at.desc())
        )
        # trips are booked ahead, so filter by when the request was raised, not when it starts
        raised_on = func.date(TravelRequest.created_at)
        if date_from is not None:
            stmt = stmt.where(raised_on >= date_from)
        if date_to is not None:
            stmt = stmt.where(raised_on <= date_to)
        return list(self.db.execute(stmt).scalars().all())

    def trip_counts_by_employee(self) -> dict[int, tuple[int, int]]:
        # Employee directory: (submitted trips, open trips) per employee
        stmt = (
            select(
                TravelRequest.employee_id,
                func.count(),
                func.count().filter(TravelRequest.status.in_(OPEN_TRIP_STATUSES)),
            )
            .where(TravelRequest.status != TravelRequestStatus.DRAFT)
            .group_by(TravelRequest.employee_id)
        )
        return {
            employee_id: (total, open_count)
            for employee_id, total, open_count in self.db.execute(stmt).all()
        }

    def save(self, travel_request: TravelRequest) -> TravelRequest:
        # Persist request (+ cascaded approvals / settlement) in one commit
        self.db.add(travel_request)
        self.db.commit()
        self.db.refresh(travel_request)
        return travel_request

    def clear_approvals(self, travel_request: TravelRequest) -> None:
        travel_request.approvals.clear()
        self.db.flush()
