"""Shared FastAPI dependencies."""

from typing import Annotated, Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.capabilities import Capability, has_capability
from core.exceptions import AppException
from core.security import decode_access_token
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.models.employee import Employee
from database.postgres.session import get_db

# Access token arrives as "Authorization: Bearer <jwt>"
bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> AppException:
    return AppException(
        status_code=401,
        sub_status_code="not_authenticated",
        message="Please sign in to continue",
    )


def get_current_employee(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> Employee:
    # Read the access JWT from the Bearer header
    token = credentials.credentials if credentials else None
    if not token:
        raise _unauthorized()

    # Resolve the acting employee from the token subject
    employee_id = decode_access_token(token)
    if employee_id is None:
        raise _unauthorized()

    employee = EmployeeCRUD(db).get_by("id", employee_id)
    if employee is None or not employee.is_active:
        raise _unauthorized()
    return employee


def require_capability(capability: Capability) -> Callable[..., Employee]:
    """Dependency factory: current employee must have the given capability."""

    def _check(
        employee: Annotated[Employee, Depends(get_current_employee)],
    ) -> Employee:
        if not has_capability(employee.role, capability):
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message=f"Missing capability: {capability.value}",
            )
        return employee

    return _check
