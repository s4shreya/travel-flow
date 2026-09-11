from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.deps import get_current_employee
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.travel_requests.schemas import TravelRequestCreate, TravelRequestRead
from src.travel_requests.service import TravelRequestService

router = APIRouter(prefix="/travel-requests", tags=["travel-requests"])


@router.post(
    "",
    response_model=TravelRequestRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a travel request",
)
def create_travel_request(
    payload: TravelRequestCreate,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> TravelRequestRead:
    """
    Create a travel request for the employee in `X-Employee-Code`.

    - `submit=true` (default): status `pending_approval` + approval steps from policy.
    - `submit=false`: save as `draft` with no approvals yet.
    """
    # Delegate orchestration to the service layer
    created = TravelRequestService(db).create(employee, payload)
    return TravelRequestRead.model_validate(created)
