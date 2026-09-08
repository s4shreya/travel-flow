from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.postgres.session import Base
from database.postgres.models.enums import SettlementStatus, str_enum


class TravelSettlement(Base):
    __tablename__ = "travel_settlements"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    travel_request_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_requests.id"),
        nullable=False,
        unique=True,
    )
    settlement_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[SettlementStatus] = mapped_column(
        str_enum(SettlementStatus, "settlement_status"),
        nullable=False,
        default=SettlementStatus.DRAFT,
        server_default=SettlementStatus.DRAFT.value,
        index=True,
    )
    total_employee_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    total_company_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    disallowed_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    net_reimbursable: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    advance_applied: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    amount_payable: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    amount_recoverable: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    travel_request: Mapped["TravelRequest"] = relationship(back_populates="settlement")
    expenses: Mapped[list["TravelExpense"]] = relationship(
        back_populates="settlement",
        cascade="all, delete-orphan",
    )
    approvals: Mapped[list["TravelSettlementApproval"]] = relationship(
        back_populates="settlement",
        cascade="all, delete-orphan",
        order_by="TravelSettlementApproval.level",
    )
