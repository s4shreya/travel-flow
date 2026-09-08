from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.postgres.session import Base
from database.postgres.models.enums import ExpenseSection, PaidBy, str_enum


class TravelExpense(Base):
    __tablename__ = "travel_expenses"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    travel_settlement_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_settlements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section: Mapped[ExpenseSection] = mapped_column(
        str_enum(ExpenseSection, "expense_section"),
        nullable=False,
    )
    expense_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    paid_by: Mapped[PaidBy] = mapped_column(
        str_enum(PaidBy, "paid_by"),
        nullable=False,
        default=PaidBy.EMPLOYEE,
        server_default=PaidBy.EMPLOYEE.value,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    proof_ref: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    disallowed_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    disallow_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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

    settlement: Mapped["TravelSettlement"] = relationship(back_populates="expenses")
    lodging: Mapped[Optional["TravelExpenseLodging"]] = relationship(
        back_populates="expense",
        uselist=False,
        cascade="all, delete-orphan",
    )
    transport: Mapped[Optional["TravelExpenseTransport"]] = relationship(
        back_populates="expense",
        uselist=False,
        cascade="all, delete-orphan",
    )
    other: Mapped[Optional["TravelExpenseOther"]] = relationship(
        back_populates="expense",
        uselist=False,
        cascade="all, delete-orphan",
    )


class TravelExpenseLodging(Base):
    __tablename__ = "travel_expense_lodging"

    travel_expense_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_expenses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    hotel_name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)

    expense: Mapped[TravelExpense] = relationship(back_populates="lodging")


class TravelExpenseTransport(Base):
    __tablename__ = "travel_expense_transport"

    travel_expense_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_expenses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    expense_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    from_location: Mapped[str] = mapped_column(String(255), nullable=False)
    to_location: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[str] = mapped_column(String(64), nullable=False)

    expense: Mapped[TravelExpense] = relationship(back_populates="transport")


class TravelExpenseOther(Base):
    __tablename__ = "travel_expense_other"

    travel_expense_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_expenses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    head: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    expense: Mapped[TravelExpense] = relationship(back_populates="other")
