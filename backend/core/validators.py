"""Shared request validation rules (money, text, policy limits)."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator

# Policy limits
MAX_AMOUNT = Decimal("10000000")  # ₹1 crore per single amount
MAX_TRIP_DAYS = 90
MAX_DAYS_IN_ADVANCE = 365
MAX_ESTIMATE_HEADS = 20
MAX_EXPENSE_LINES = 100
MAX_LODGING_NIGHTS = 90
PURPOSE_MIN = 10
PURPOSE_MAX = 2000

# Smallest rupee unit (amounts are stored to 2 decimals)
PAISA = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    if not value.is_finite():
        raise ValueError("must be a valid amount")
    if value < 0:
        raise ValueError("cannot be negative")
    if value > MAX_AMOUNT:
        raise ValueError("cannot exceed ₹1,00,00,000")
    # Paise precision only, no fractions of a paisa
    if value != value.quantize(PAISA):
        raise ValueError("must have at most 2 decimal places")
    return value


def _positive_money(value: Decimal) -> Decimal:
    value = _money(value)
    if value == 0:
        raise ValueError("must be greater than zero")
    return value


# Non-negative rupee amount, capped and limited to 2 decimals
Money = Annotated[Decimal, AfterValidator(_money)]

# Strictly positive rupee amount (expense lines, releases)
PositiveMoney = Annotated[Decimal, AfterValidator(_positive_money)]


def clean_text(value: str | None) -> str | None:
    """Trim and collapse internal whitespace; blank becomes None."""
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def require_text(value: str) -> str:
    cleaned = clean_text(value)
    if not cleaned:
        raise ValueError("must not be blank")
    return cleaned


def not_in_future(value: date | None, label: str) -> None:
    if value and value > date.today():
        raise ValueError(f"{label} cannot be in the future")
