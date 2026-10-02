from datetime import datetime

from pydantic import BaseModel

from database.postgres.models.enums import EmployeeRole


class EmployeeDirectoryItem(BaseModel):
    """Employee row for the administration directory."""

    id: int
    employee_code: str
    name: str
    email: str
    designation: str
    department: str
    cost_centre: str
    city: str
    role: EmployeeRole
    manager_name: str | None = None
    is_active: bool
    last_login_at: datetime | None = None
    trips_total: int = 0
    trips_open: int = 0
