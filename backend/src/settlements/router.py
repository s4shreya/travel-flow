from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.capabilities import Capability
from core.deps import get_current_employee, require_capability
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.settlements.schemas import SettlementRead, SettlementSave
from src.settlements.service import SettlementService

router = APIRouter(prefix="/travel-requests", tags=["settlements"])


@router.get(
    "/{travel_request_id}/settlement",
    response_model=SettlementRead | None,
    summary="Get settlement for a travel request",
)
def get_settlement(
    travel_request_id: str,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> SettlementRead | None:
    return SettlementService(db).get(employee, travel_request_id)


@router.put(
    "/{travel_request_id}/settlement",
    response_model=SettlementRead,
    summary="Create or update settlement draft / submit",
)
def save_settlement(
    travel_request_id: str,
    payload: SettlementSave,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> SettlementRead:
    return SettlementService(db).save(employee, travel_request_id, payload)


@router.post(
    "/{travel_request_id}/settlement/mark-paid",
    response_model=SettlementRead,
    summary="Mark settlement paid / recovery noted (Finance)",
)
def mark_settlement_paid(
    travel_request_id: str,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[
        Employee, Depends(require_capability(Capability.RELEASE_FUNDS))
    ],
) -> SettlementRead:
    return SettlementService(db).mark_paid(employee, travel_request_id)
