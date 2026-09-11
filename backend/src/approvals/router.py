from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.capabilities import Capability
from core.deps import require_capability
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.approvals.schemas import ApprovalDecideRequest, ApprovalInboxItem
from src.approvals.service import ApprovalService
from src.travel_requests.schemas import ApprovalStepRead

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get(
    "/inbox",
    response_model=list[ApprovalInboxItem],
    summary="Pending approvals for the current employee",
)
def approval_inbox(
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[
        Employee, Depends(require_capability(Capability.APPROVE_REQUESTS))
    ],
) -> list[ApprovalInboxItem]:
    return ApprovalService(db).inbox(employee)


@router.post(
    "/{approval_id}/decide",
    response_model=ApprovalStepRead,
    summary="Approve, return, or reject a pending step",
)
def decide_approval(
    approval_id: int,
    payload: ApprovalDecideRequest,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[
        Employee, Depends(require_capability(Capability.APPROVE_REQUESTS))
    ],
) -> ApprovalStepRead:
    row = ApprovalService(db).decide(employee, approval_id, payload)
    return ApprovalStepRead.model_validate(row)
