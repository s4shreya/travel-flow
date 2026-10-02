from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database.postgres.models.enums import ApprovalDecision
from database.postgres.models.travel_approvals import (
    TravelRequestApproval,
    TravelSettlementApproval,
)
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement

# Request step: its trip, the whole chain and the requester
_REQUEST_STEP_OPTIONS = (
    selectinload(TravelRequestApproval.travel_request).selectinload(TravelRequest.approvals),
    selectinload(TravelRequestApproval.travel_request).selectinload(TravelRequest.employee),
)
# Settlement step: its settlement (chain + lines) and the trip with its requester
_SETTLEMENT_STEP_OPTIONS = (
    selectinload(TravelSettlementApproval.settlement).selectinload(TravelSettlement.approvals),
    selectinload(TravelSettlementApproval.settlement).selectinload(TravelSettlement.expenses),
    selectinload(TravelSettlementApproval.settlement)
    .selectinload(TravelSettlement.travel_request)
    .selectinload(TravelRequest.employee),
)


class ApprovalCRUD:
    """Persistence helpers for travel-request and settlement approval steps."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_inbox_for_approver(self, approver_id: int) -> list[TravelRequestApproval]:
        # Pending request steps assigned to this person
        stmt = (
            select(TravelRequestApproval)
            .where(
                TravelRequestApproval.approver_id == approver_id,
                TravelRequestApproval.decision == ApprovalDecision.PENDING,
            )
            .options(*_REQUEST_STEP_OPTIONS)
            .order_by(TravelRequestApproval.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_settlement_inbox_for_approver(
        self, approver_id: int
    ) -> list[TravelSettlementApproval]:
        # Pending settlement reviews assigned to this person
        stmt = (
            select(TravelSettlementApproval)
            .where(
                TravelSettlementApproval.approver_id == approver_id,
                TravelSettlementApproval.decision == ApprovalDecision.PENDING,
            )
            .options(*_SETTLEMENT_STEP_OPTIONS)
            .order_by(TravelSettlementApproval.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_by_id(self, approval_id: int) -> TravelRequestApproval | None:
        stmt = (
            select(TravelRequestApproval)
            .where(TravelRequestApproval.id == approval_id)
            .options(*_REQUEST_STEP_OPTIONS)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_settlement_by_id(
        self, approval_id: int
    ) -> TravelSettlementApproval | None:
        stmt = (
            select(TravelSettlementApproval)
            .where(TravelSettlementApproval.id == approval_id)
            .options(*_SETTLEMENT_STEP_OPTIONS)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def save(
        self, approval: TravelRequestApproval | TravelSettlementApproval
    ) -> TravelRequestApproval | TravelSettlementApproval:
        # Commit the decision together with everything else in the session
        self.db.add(approval)
        self.db.commit()
        self.db.refresh(approval)
        return approval
