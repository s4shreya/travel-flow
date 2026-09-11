"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from core.exceptions import AppException
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.models.employee import Employee
from database.postgres.session import get_db


def get_current_employee(
    db: Annotated[Session, Depends(get_db)],
    x_employee_code: Annotated[
        str,
        Header(
            description="Demo auth: employee code of the signed-in user (e.g. NX-4471).",
        ),
    ],
) -> Employee:
    # Resolve the acting employee
    # Real auth (JWT/SSO) is added later
    employee = EmployeeCRUD(db).get_by("employee_code", x_employee_code.strip())
    if employee is None:
        raise AppException(
            status_code=401,
            sub_status_code="employee_not_found",
            message=f"Unknown employee code: {x_employee_code}",
        )
    return employee
