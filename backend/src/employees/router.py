from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.capabilities import Capability
from core.deps import require_capability
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.employees.schemas import EmployeeDirectoryItem
from src.employees.service import EmployeeDirectoryService

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get(
    "",
    response_model=list[EmployeeDirectoryItem],
    summary="Employee directory (administrators, read-only)",
)
def list_employees(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Employee, Depends(require_capability(Capability.VIEW_EMPLOYEES))],
) -> list[EmployeeDirectoryItem]:
    return EmployeeDirectoryService(db).list_directory()
