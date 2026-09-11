from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database.postgres.models.enums import ApprovalDecision
from database.postgres.models.travel_approvals import TravelRequestApproval
from database.postgres.models.travel_request import TravelRequest


class ApprovalCRUD:
    """Persistence helpers for travel-request approval steps."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_inbox_for_approver(self, approver_id: int) -> list[TravelRequestApproval]:
        # Pending steps assigned to this person
        stmt = (
            select(TravelRequestApproval)
            .where(
                TravelRequestApproval.approver_id == approver_id,
                TravelRequestApproval.decision == ApprovalDecision.PENDING,
            )
            .options(
                selectinload(TravelRequestApproval.travel_request).selectinload(
                    TravelRequest.approvals
                )
            )
            .order_by(TravelRequestApproval.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_by_id(self, approval_id: int) -> TravelRequestApproval | None:
        stmt = (
            select(TravelRequestApproval)
            .where(TravelRequestApproval.id == approval_id)
            .options(
                selectinload(TravelRequestApproval.travel_request).selectinload(
                    TravelRequest.approvals
                )
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def save(self, approval: TravelRequestApproval) -> TravelRequestApproval:
        self.db.add(approval)
        self.db.commit()
        self.db.refresh(approval)
        return approval
