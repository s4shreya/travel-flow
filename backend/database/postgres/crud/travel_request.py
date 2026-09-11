from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from database.postgres.models.travel_approvals import TravelRequestApproval
from database.postgres.models.travel_request import TravelRequest


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
            .options(selectinload(TravelRequest.approvals))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def add_approvals(
        self, approvals: list[TravelRequestApproval]
    ) -> list[TravelRequestApproval]:
        # Attach approval rows
        self.db.add_all(approvals)
        return approvals
