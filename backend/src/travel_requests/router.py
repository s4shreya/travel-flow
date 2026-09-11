from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.capabilities import Capability
from core.deps import get_current_employee, require_capability
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.travel_requests.schemas import (
    AdvanceReleaseRequest,
    TravelRequestCreate,
    TravelRequestListItem,
    TravelRequestRead,
)
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
    employee: Annotated[
        Employee, Depends(require_capability(Capability.CREATE_REQUEST))
    ],
) -> TravelRequestRead:
    # Delegate orchestration to the service layer
    created = TravelRequestService(db).create(employee, payload)
    return TravelRequestRead.model_validate(created)


@router.get(
    "",
    response_model=list[TravelRequestListItem],
    summary="List my travel requests",
)
def list_my_travel_requests(
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[
        Employee, Depends(require_capability(Capability.TRACK_REQUESTS))
    ],
) -> list[TravelRequestListItem]:
    rows = TravelRequestService(db).list_mine(employee)
    return [TravelRequestListItem.model_validate(row) for row in rows]


@router.get(
    "/{travel_request_id}",
    response_model=TravelRequestRead,
    summary="Get a travel request",
)
def get_travel_request(
    travel_request_id: str,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[
        Employee, Depends(require_capability(Capability.TRACK_REQUESTS))
    ],
) -> TravelRequestRead:
    row = TravelRequestService(db).get_for_viewer(employee, travel_request_id)
    return TravelRequestRead.model_validate(row)


@router.post(
    "/{travel_request_id}/advance/release",
    response_model=TravelRequestRead,
    summary="Release travel advance (Finance)",
)
def release_advance(
    travel_request_id: str,
    payload: AdvanceReleaseRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Employee, Depends(require_capability(Capability.RELEASE_FUNDS))],
) -> TravelRequestRead:
    row = TravelRequestService(db).release_advance(travel_request_id, payload)
    return TravelRequestRead.model_validate(row)
