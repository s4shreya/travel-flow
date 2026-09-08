from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.postgres.session import Base
from database.postgres.models.travel_request import TravelRequest


class Employee(Base):
    __tablename__ = "employees"

    emp_code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    designation: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(128), nullable=False)
    cost_centre: Mapped[str] = mapped_column(String(32), nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    reporting_manager_code: Mapped[Optional[str]] = mapped_column(
        String(32),
        ForeignKey("employees.emp_code"),
        nullable=True,
    )
    role: Mapped[str] = mapped_column(String(64), nullable=False)

    # Defines the relationship between the Employee and TravelRequest models
    travel_requests: Mapped[list[TravelRequest]] = relationship(
        back_populates="employee",
    )
