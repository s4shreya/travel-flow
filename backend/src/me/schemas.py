from typing import Any, Self

from pydantic import BaseModel, ConfigDict

from core.capabilities import Capability, capabilities_for_role
from database.postgres.models.employee import Employee
from database.postgres.models.enums import EmployeeRole


class EmployeeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_code: str
    name: str
    designation: str
    department: str
    role: EmployeeRole
    city: str


class MeResponse(BaseModel):
    """Signed-in employee + capabilities (authz source of truth for the UI)."""

    employee: EmployeeSummary
    capabilities: list[Capability]

    @classmethod
    def for_employee(cls, employee: Employee, **extra: Any) -> Self:
        return cls(
            employee=EmployeeSummary.model_validate(employee),
            capabilities=capabilities_for_role(employee.role),
            **extra,
        )
