from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.postgres.session import Base
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    TravelCategory,
    TravelMode,
    TravelRequestStatus,
    str_enum,
)


class TravelRequest(Base):
    __tablename__ = "travel_requests"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    travel_request_id: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False
    )
    employee_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("employees.id"),
        nullable=False,
        index=True,
    )

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    travel_category: Mapped[TravelCategory] = mapped_column(
        str_enum(TravelCategory, "travel_category"),
        nullable=False,
        default=TravelCategory.DOMESTIC_TIER_1,
        server_default=TravelCategory.DOMESTIC_TIER_1.value,
    )
    travel_mode: Mapped[TravelMode] = mapped_column(
        str_enum(TravelMode, "travel_mode"),
        nullable=False,
        default=TravelMode.FLIGHT,
        server_default=TravelMode.FLIGHT.value,
    )
    currency: Mapped[str] = mapped_column(
        String(8),
        nullable=False,
        default="INR",
        server_default="INR",
    )

    estimated_heads: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    estimated_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    advance_requested: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    advance_disbursed: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )

    status: Mapped[TravelRequestStatus] = mapped_column(
        str_enum(TravelRequestStatus, "travel_request_status"),
        nullable=False,
        default=TravelRequestStatus.DRAFT,
        server_default=TravelRequestStatus.DRAFT.value,
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

    employee: Mapped[Employee] = relationship(back_populates="travel_requests")
    settlement: Mapped[Optional["TravelSettlement"]] = relationship(
        back_populates="travel_request",
        uselist=False,
    )
    approvals: Mapped[list["TravelRequestApproval"]] = relationship(
        back_populates="travel_request",
        cascade="all, delete-orphan",
        order_by="TravelRequestApproval.level",
    )
    receipts: Mapped[list["TravelReceipt"]] = relationship(
        back_populates="travel_request",
        cascade="all, delete-orphan",
        order_by="TravelReceipt.created_at",
    )
