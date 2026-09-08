from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.postgres.session import Base
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ApprovalDecision,
    EmployeeRole,
    str_enum,
)


class _ApprovalMixin:
    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    role_required: Mapped[EmployeeRole] = mapped_column(
        str_enum(EmployeeRole, "employee_role"),
        nullable=False,
    )
    approver_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("employees.id"),
        nullable=True,
        index=True,
    )
    decision: Mapped[ApprovalDecision] = mapped_column(
        str_enum(ApprovalDecision, "approval_decision"),
        nullable=False,
        default=ApprovalDecision.PENDING,
        server_default=ApprovalDecision.PENDING.value,
    )
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class TravelRequestApproval(_ApprovalMixin, Base):
    __tablename__ = "travel_request_approvals"
    __table_args__ = (
        UniqueConstraint(
            "travel_request_id",
            "level",
            name="uq_travel_request_approvals_level",
        ),
    )

    travel_request_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    travel_request: Mapped["TravelRequest"] = relationship(back_populates="approvals")
    approver: Mapped[Optional[Employee]] = relationship(foreign_keys=[approver_id])


class TravelSettlementApproval(_ApprovalMixin, Base):
    __tablename__ = "travel_settlement_approvals"
    __table_args__ = (
        UniqueConstraint(
            "travel_settlement_id",
            "level",
            name="uq_travel_settlement_approvals_level",
        ),
    )

    travel_settlement_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_settlements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    settlement: Mapped["TravelSettlement"] = relationship(back_populates="approvals")
    approver: Mapped[Optional[Employee]] = relationship(foreign_keys=[approver_id])
