from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.capabilities import capabilities_for_role
from core.deps import get_current_employee
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.me.schemas import EmployeeSummary, MeResponse

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse, summary="Current employee + capabilities")
def get_me(
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> MeResponse:
    # Capabilities come only from backend role mapping
    return MeResponse(
        employee=EmployeeSummary.model_validate(employee),
        capabilities=capabilities_for_role(employee.role),
    )


@router.get(
    "/employees",
    response_model=list[EmployeeSummary],
    summary="Employee directory (demo persona switcher)",
)
def list_employees(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Employee, Depends(get_current_employee)],
) -> list[EmployeeSummary]:
    # Simple directory for the demo switcher; real auth would scope this differently
    rows = EmployeeCRUD(db).list_all()
    return [EmployeeSummary.model_validate(row) for row in rows]
