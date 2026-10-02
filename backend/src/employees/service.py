from sqlalchemy.orm import Session

from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.crud.travel_request import TravelRequestCRUD
from src.employees.schemas import EmployeeDirectoryItem


class EmployeeDirectoryService:
    """Read-only employee directory for administrators."""

    def __init__(self, db: Session) -> None:
        self.employees = EmployeeCRUD(db)
        self.trips = TravelRequestCRUD(db)

    def list_directory(self) -> list[EmployeeDirectoryItem]:
        employees = self.employees.list_all()
        names = {emp.id: emp.name for emp in employees}
        counts = self.trips.trip_counts_by_employee()

        rows: list[EmployeeDirectoryItem] = []
        for emp in employees:
            trips_total, trips_open = counts.get(emp.id, (0, 0))
            rows.append(
                EmployeeDirectoryItem(
                    id=emp.id,
                    employee_code=emp.employee_code,
                    name=emp.name,
                    email=emp.email,
                    designation=emp.designation,
                    department=emp.department,
                    cost_centre=emp.cost_centre,
                    city=emp.city,
                    role=emp.role,
                    manager_name=names.get(emp.reporting_manager_id),
                    is_active=emp.is_active,
                    last_login_at=emp.last_login_at,
                    trips_total=trips_total,
                    trips_open=trips_open,
                )
            )
        return rows
