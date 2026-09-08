from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.postgres.session import Base
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.enums import EmployeeRole


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    designation: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(128), nullable=False)
    cost_centre: Mapped[str] = mapped_column(String(32), nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    reporting_manager_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("employees.id"),
        nullable=True,
    )
    role: Mapped[EmployeeRole] = mapped_column(
        Enum(
            EmployeeRole,
            name="employee_role",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            native_enum=False,
        ),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Defines the relationship between the Employee and TravelRequest models
    travel_requests: Mapped[list[TravelRequest]] = relationship(
        back_populates="employee",
    )
