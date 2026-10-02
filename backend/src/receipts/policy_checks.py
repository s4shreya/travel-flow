"""Compare a parsed receipt with Travel & Expense Policy NTX-HR-POL-11."""

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from core.expense_policy import (
    ENTERTAINMENT_PRE_APPROVAL_ABOVE,
    LODGING_LIMIT_PER_NIGHT,
    MEAL_BILL_REQUIRED_ABOVE,
    SUBMISSION_WINDOW_DAYS,
    TIER_1_CITIES,
    meal_limit,
)
from database.postgres.models.enums import PaidBy, TravelCategory
from database.postgres.models.travel_expense import TravelExpense
from database.postgres.models.travel_request import TravelRequest
from src.receipts.parser import ParsedReceipt

Level = Literal["info", "warning", "violation"]


@dataclass
class PolicyFinding:
    level: Level
    code: str
    message: str


@dataclass
class PolicyResult:
    findings: list[PolicyFinding] = field(default_factory=list)
    disallowed: Decimal = Decimal("0")
    reasons: list[str] = field(default_factory=list)
    paid_by: PaidBy = PaidBy.EMPLOYEE

    def add(self, level: Level, code: str, message: str) -> None:
        self.findings.append(PolicyFinding(level, code, message))

    def disallow(self, amount: Decimal, reason: str) -> None:
        self.disallowed += amount
        self.reasons.append(reason)


def _inr(value: Decimal) -> str:
    return f"₹{value:,.2f}"


def evidence_check(parsed: ParsedReceipt, text: str, name: str) -> tuple[str, str | None]:
    """Is the file a bill, and does it look like travel spend? Returns (status, note)."""
    if not text.strip():
        return "not_receipt", (
            f"No readable text was found in {name}. It may not be a bill — upload a clearer "
            "copy or fill the expense manually."
        )
    if not parsed.is_bill:
        return "not_receipt", (
            f"{name} does not look like a bill or receipt — no total, invoice or tax details "
            "were found. Upload the actual bill, or fill the expense manually."
        )
    if not parsed.travel_related:
        return "needs_review", (
            f"{name} looks like a bill, but not for travel — no hotel, transport or meal details "
            "were found. Check it belongs to this trip before claiming it."
        )
    return "matched", None


def check_receipt(
    parsed: ParsedReceipt,
    trip: TravelRequest,
    existing_lines: list[TravelExpense],
    today: date | None = None,
) -> PolicyResult:
    today = today or date.today()
    result = PolicyResult()
    amount = parsed.amount

    if amount is None:
        result.add("warning", "amount_unreadable", "Couldn't read the total. Enter the amount from the receipt.")

    # §4 non-reimbursable items are excluded even when on a consolidated bill
    flagged_total = Decimal("0")
    for item in parsed.flagged:
        if item.amount is not None and amount is not None and flagged_total + item.amount <= amount:
            flagged_total += item.amount
            result.disallow(item.amount, item.label)
            result.add(
                "violation", "non_reimbursable",
                f"{item.label} ({_inr(item.amount)}) is not reimbursable (§4) and is shown as disallowed.",
            )
        else:
            result.add(
                "warning", "non_reimbursable",
                f"“{item.line}” looks like {item.label.lower()}, which is not reimbursable (§4). "
                "Enter its amount as disallowed.",
            )
    eligible = (amount - flagged_total) if amount is not None else None

    # §3.1 lodging per-night cap (hotel city decides the tier when known)
    if parsed.section == "lodging":
        category = (
            TravelCategory.DOMESTIC_TIER_1
            if parsed.city and parsed.city in TIER_1_CITIES.values()
            else trip.travel_category
        )
        limit = LODGING_LIMIT_PER_NIGHT.get(category, LODGING_LIMIT_PER_NIGHT[TravelCategory.DOMESTIC_TIER_3])
        nights = (
            (parsed.check_out - parsed.check_in).days
            if parsed.check_in and parsed.check_out
            else parsed.nights
        )
        if nights and nights > 0 and eligible is not None:
            # taxes are reimbursable in full, so only the tariff is capped
            tariff = eligible - parsed.tax if parsed.tax < eligible else eligible
            cap = limit * nights
            if tariff > cap:
                excess = tariff - cap
                result.disallow(excess, f"Lodging above {_inr(limit)}/night")
                result.add(
                    "violation", "lodging_over_limit",
                    f"Room tariff {_inr(tariff / nights)}/night is above the {_inr(limit)} limit for "
                    f"{category.value} (§3.1). {_inr(excess)} is shown as disallowed; taxes are "
                    "reimbursed in full.",
                )
            else:
                result.add("info", "lodging_within_limit", f"Within the {_inr(limit)}/night lodging limit (§3.1).")
        else:
            result.add("info", "lodging_nights_unknown", f"Add check-in and check-out to check the {_inr(limit)}/night limit (§3.1).")

    # §3.2 flights are booked by the travel desk and billed to the company
    if parsed.section == "transport" and parsed.mode == "Flight":
        result.paid_by = PaidBy.COMPANY
        result.add(
            "violation", "air_travel_desk",
            "Air travel is booked by the travel desk and billed to the company (§3.2). "
            "It is marked company-paid and won't be reimbursed to you.",
        )
    elif parsed.section == "transport":
        result.add("info", "local_conveyance", "Local conveyance is reimbursed on actuals against this receipt (§3.4).")

    # §3.3 meals cap per day
    if parsed.head == "Meals" and eligible is not None:
        limit = meal_limit(trip.travel_category)
        if eligible > limit:
            excess = eligible - limit
            result.disallow(excess, f"Meals above {_inr(limit)}/day")
            result.add(
                "violation", "meal_over_limit",
                f"Meals are capped at {_inr(limit)} per day for {trip.travel_category.value} (§3.3). "
                f"{_inr(excess)} is shown as disallowed. If guests were hosted, claim it as "
                "Business Entertainment instead.",
            )
        elif eligible > MEAL_BILL_REQUIRED_ABOVE:
            result.add("info", "meal_bill", "Bill attached — required for meals above ₹500 (§3.3).")
        if eligible > ENTERTAINMENT_PRE_APPROVAL_ABOVE:
            result.add(
                "info", "entertainment_hint",
                f"Hosting customers? Business Entertainment above {_inr(ENTERTAINMENT_PRE_APPROVAL_ABOVE)} "
                "needs attendee names and prior HoD approval (§3.5).",
            )

    # dates must fall inside the trip (± one travel day)
    for value in (parsed.check_in, parsed.check_out, parsed.expense_date):
        if value and not (trip.start_date - timedelta(days=1) <= value <= trip.end_date + timedelta(days=1)):
            result.add(
                "warning", "outside_trip",
                f"Date {value:%d %b %Y} is outside the trip ({trip.start_date:%d %b} – {trip.end_date:%d %b %Y}).",
            )
            break

    # §5.3 duplicate bills (same amount on the same date already claimed)
    if amount is not None:
        for line in existing_lines:
            if line.amount == amount and parsed.expense_date and line.expense_date == parsed.expense_date:
                result.add(
                    "warning", "possible_duplicate",
                    f"A {_inr(amount)} line dated {line.expense_date:%d %b %Y} is already on this "
                    "settlement. Duplicate bills are a policy breach (§5.3).",
                )
                break

    # §5.1 submit within 7 days of return
    deadline = trip.end_date + timedelta(days=SUBMISSION_WINDOW_DAYS)
    if today > deadline:
        result.add(
            "warning", "late_submission",
            f"Claims are due within {SUBMISSION_WINDOW_DAYS} days of return (by {deadline:%d %b %Y}, §5.1).",
        )

    if parsed.confidence == "low":
        result.add("info", "low_confidence", "The scan was hard to read — check every field before saving.")

    # Never disallow more than the bill
    if amount is not None:
        result.disallowed = min(result.disallowed, amount).quantize(Decimal("0.01"))
    return result
