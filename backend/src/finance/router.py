from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.capabilities import Capability
from core.deps import require_capability
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.travel_requests.schemas import TravelRequestListItem
from src.travel_requests.service import TravelRequestService

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get(
    "/advances",
    response_model=list[TravelRequestListItem],
    summary="Approved trips awaiting advance disbursement",
)
def list_advances(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Employee, Depends(require_capability(Capability.RELEASE_FUNDS))],
) -> list[TravelRequestListItem]:
    rows = TravelRequestService(db).list_awaiting_advance()
    return [TravelRequestListItem.model_validate(row) for row in rows]
