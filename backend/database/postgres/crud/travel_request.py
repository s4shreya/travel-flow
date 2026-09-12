from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from database.postgres.models.enums import TravelRequestStatus
from database.postgres.models.travel_approvals import TravelRequestApproval
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement


class TravelRequestCRUD:
    """Persistence helpers for travel requests."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def next_travel_request_id(self, year: int) -> str:
        # Allocate TRQ-YYYY-NNNN from the highest existing id for that year
        prefix = f"TRQ-{year}-"
        stmt = select(func.max(TravelRequest.travel_request_id)).where(
            TravelRequest.travel_request_id.like(f"{prefix}%")
        )
        latest = self.db.execute(stmt).scalar_one_or_none()
        if latest is None:
            seq = 1
        else:
            seq = int(latest.rsplit("-", maxsplit=1)[-1]) + 1
        return f"{prefix}{seq:04d}"

    def create(self, travel_request: TravelRequest) -> TravelRequest:
        # Persist request (+ cascaded approvals) in one flush
        self.db.add(travel_request)
        self.db.commit()
        self.db.refresh(travel_request)
        return travel_request

    def get_by_business_id(self, travel_request_id: str) -> TravelRequest | None:
        # Load request with approval steps for API responses
        stmt = (
            select(TravelRequest)
            .where(TravelRequest.travel_request_id == travel_request_id)
            .options(
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
        stmt = (
            select(TravelRequest)
            .where(TravelRequest.employee_id == employee_id)
            .options(
                selectinload(TravelRequest.approvals),
                selectinload(TravelRequest.settlement).selectinload(
                    TravelSettlement.approvals
                ),
            )
            .order_by(TravelRequest.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_awaiting_settlement_payment(self) -> list[TravelRequest]:
        # Finance queue: approved settlements waiting for fund release / recovery note
        from database.postgres.models.enums import SettlementStatus

        stmt = (
            select(TravelRequest)
            .join(TravelSettlement)
            .where(
                TravelSettlement.status.in_(
                    [
                        SettlementStatus.QUEUED_FOR_PAYMENT,
                        SettlementStatus.RECOVERABLE,
                    ]
                )
            )
            .options(
                selectinload(TravelRequest.approvals),
                selectinload(TravelRequest.settlement).selectinload(
                    TravelSettlement.approvals
                ),
            )
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
            .options(
                selectinload(TravelRequest.approvals),
                selectinload(TravelRequest.settlement).selectinload(
                    TravelSettlement.approvals
                ),
            )
            .order_by(TravelRequest.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def save(self, travel_request: TravelRequest) -> TravelRequest:
        self.db.add(travel_request)
        self.db.commit()
        self.db.refresh(travel_request)
        return travel_request

    def clear_approvals(self, travel_request_pk: int) -> None:
        # Wipe prior chain so a draft resubmit can rebuild cleanly
        self.db.execute(
            delete(TravelRequestApproval).where(
                TravelRequestApproval.travel_request_id == travel_request_pk
            )
        )
        self.db.flush()

    def add_approvals(
        self, approvals: list[TravelRequestApproval]
    ) -> list[TravelRequestApproval]:
        # Attach approval rows
        self.db.add_all(approvals)
        return approvals
