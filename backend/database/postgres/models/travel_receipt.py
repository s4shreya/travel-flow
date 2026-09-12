"""Travel receipts linked to a travel request (supporting docs for settlement)."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.postgres.session import Base


class TravelReceipt(Base):
    __tablename__ = "travel_receipts"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    travel_request_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("travel_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_by_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    travel_request: Mapped["TravelRequest"] = relationship(back_populates="receipts")
