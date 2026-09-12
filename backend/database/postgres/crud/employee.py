from sqlalchemy import select
from sqlalchemy.orm import Session

from database.postgres.models.employee import Employee
from database.postgres.models.enums import EmployeeRole


class EmployeeCRUD:
    """Persistence helpers for employees."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by(self, field: str, value) -> Employee | None:
        # Look up a single employee by any mapped column (e.g. id, employee_code)
        column = getattr(Employee, field, None)
        if column is None:
            raise ValueError(f"Invalid employee field: {field}")
        stmt = select(Employee).where(column == value)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_all(self) -> list[Employee]:
        stmt = select(Employee).order_by(Employee.id)
        return list(self.db.execute(stmt).scalars().all())

    def get_management_chain(self, employee: Employee) -> list[Employee]:
        """Walk reporting_manager_id upward (immediate manager → … → MD)."""
        chain: list[Employee] = []
        seen: set[int] = set()
        current_id = employee.reporting_manager_id
        while current_id is not None and current_id not in seen:
            seen.add(current_id)
            manager = self.get_by("id", current_id)
            if manager is None:
                break
            chain.append(manager)
            current_id = manager.reporting_manager_id
        return chain

    def first_by_role(self, role: EmployeeRole) -> Employee | None:
        """First employee with the given role (used for Finance settlement step)."""
        stmt = select(Employee).where(Employee.role == role).order_by(Employee.id)
        return self.db.execute(stmt).scalars().first()
