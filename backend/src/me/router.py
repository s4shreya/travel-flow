from typing import Annotated

from fastapi import APIRouter, Depends

from core.deps import get_current_employee
from database.postgres.models.employee import Employee
from src.me.schemas import MeResponse

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse, summary="Current employee + capabilities")
def get_me(
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> MeResponse:
    # Capabilities come only from backend role mapping
    return MeResponse.for_employee(employee)
