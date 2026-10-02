"""Rule-based receipt parsing: amount, dates, merchant and expense category from OCR text."""

import re
from dataclasses import dataclass, field
from datetime import date, time
from decimal import Decimal, InvalidOperation

from core.expense_policy import NON_REIMBURSABLE_KEYWORDS, TIER_1_CITIES
from core.validators import MAX_AMOUNT

# Keyword weights per category (strong signals count double)
LODGING_WORDS = {
    "hotel": 2,
    "resort": 2,
    "folio": 2,
    "check-in": 2,
    "check in": 2,
    "checkin": 2,
    "check-out": 2,
    "check out": 2,
    "checkout": 2,
    "arrival": 2,
    "departure": 2,
    "room": 1,
    "inn": 1,
    "lodge": 1,
    "guest": 1,
    "tariff": 1,
    "stay": 1,
    "night": 1,
    "nights": 1,
    "suite": 1,
    "oyo": 2,
    "treebo": 2,
    "fabhotel": 2,
}
TRANSPORT_WORDS = {
    "uber": 3,
    "ola": 2,
    "rapido": 3,
    "meru": 2,
    "cab": 2,
    "taxi": 2,
    "auto": 1,
    "rickshaw": 2,
    "ride": 1,
    "trip": 1,
    "pickup": 2,
    "pick up": 2,
    "drop": 1,
    "fare": 1,
    "driver": 1,
    "km": 1,
    "irctc": 3,
    "pnr": 2,
    "train": 2,
    "railway": 2,
    "berth": 2,
    "coach": 1,
    "bus": 2,
    "redbus": 3,
    "metro": 2,
    "flight": 2,
    "airline": 2,
    "boarding": 2,
    "indigo": 3,
    "air india": 3,
    "akasa": 3,
    "spicejet": 3,
    "vistara": 3,
    "toll": 2,
    "parking": 2,
    "fastag": 2,
}
MEAL_WORDS = {
    "restaurant": 2,
    "cafe": 2,
    "café": 2,
    "food": 1,
    "dine": 1,
    "dining": 1,
    "swiggy": 3,
    "zomato": 3,
    "kitchen": 1,
    "meal": 1,
    "breakfast": 1,
    "lunch": 1,
    "dinner": 1,
    "table": 1,
    "covers": 1,
    "bistro": 2,
    "biryani": 1,
    "dosa": 1,
    "thali": 1,
    "bakery": 1,
    "eatery": 2,
    "canteen": 1,
    "kot": 2,
}

# Total lines in priority order; the first keyword found wins
TOTAL_KEYWORDS = (
    "grand total",
    "net payable",
    "amount payable",
    "total payable",
    "total amount",
    "amount due",
    "balance due",
    "net amount",
    "total fare",
    "trip fare",
    "total",
)
NOT_TOTAL = (
    "sub total",
    "subtotal",
    "sub-total",
    "total tax",
    "total gst",
    "total qty",
    "total items",
)

MONTHS = {
    m: i + 1
    for i, m in enumerate(
        (
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
        )
    )
}
_MON = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*"

AMOUNT_RE = re.compile(
    r"(?<![\d.,])(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d{1,7}(?:\.\d{1,2})?)(?![\d,])",
    re.IGNORECASE,
)
CURRENCY_AMOUNT_RE = re.compile(
    r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE
)
DATE_PATTERNS = (
    # 2026-09-12
    (re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"), "ymd"),
    # 12/09/2026, 12-09-26, 12.09.2026 (Indian day-first)
    (re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b"), "dmy"),
    # 12 Sep 2026, 12-Sep-26, 12th September, 2026
    (
        re.compile(
            rf"\b(\d{{1,2}})(?:st|nd|rd|th)?[\s\-/.,']*{_MON}[\s\-/.,']*(\d{{2,4}})\b",
            re.I,
        ),
        "d_mon_y",
    ),
    # Sep 12, 2026
    (
        re.compile(
            rf"\b{_MON}[\s\-.]*(\d{{1,2}})(?:st|nd|rd|th)?,?[\s\-.]*(\d{{4}})\b", re.I
        ),
        "mon_d_y",
    ),
)
TIME_RE = re.compile(r"\b(\d{1,2}):(\d{2})\s*(am|pm)?\b", re.IGNORECASE)
NIGHTS_RE = re.compile(r"\b(\d{1,2})\s*nights?\b", re.IGNORECASE)
BILL_RE = re.compile(
    r"\b(?:invoice|inv|bill|receipt|folio|order|booking|pnr)[ \t]*(?:no|number|num|id|#)?\.?[ \t]*[:#\-]?[ \t]*([A-Z0-9][A-Z0-9\-/]{3,})",
    re.IGNORECASE,
)
# Tax lines (GST etc.) — reimbursable in full, so kept out of per-night / per-day caps
TAX_RE = re.compile(
    r"\b(?:c|s|u|i)?gst\b|\bvat\b|\bservice tax\b|\bluxury tax\b|\bcess\b",
    re.IGNORECASE,
)
FROM_TO_RE = re.compile(r"\bfrom\s*[:\-]?\s*(.+?)\s+to\s*[:\-]?\s*(.+)$", re.IGNORECASE)
PICKUP_RE = re.compile(
    r"^\s*(?:pick\s?up(?:\s+location)?|source|origin)\s*[:\-]?\s*(.+)$", re.IGNORECASE
)
DROP_RE = re.compile(
    r"^\s*(?:drop(?:\s+location)?|destination)\s*[:\-]?\s*(.+)$", re.IGNORECASE
)
# Words printed on almost every bill / invoice (used to tell bills from other documents)
BILL_WORDS = (
    "invoice",
    "receipt",
    "bill",
    "total",
    "amount",
    "gst",
    "gstin",
    "tax",
    "paid",
    "payment",
    "fare",
    "folio",
    "cash",
    "card",
    "upi",
    "qty",
    "rate",
    "subtotal",
    "booking",
    "order",
)
MERCHANT_SKIP = (
    "tax invoice",
    "invoice",
    "receipt",
    "bill of supply",
    "cash memo",
    "gstin",
    "original",
    "duplicate",
    "welcome",
    "thank",
    "customer copy",
)


@dataclass
class FlaggedItem:
    """A line matching a §4 non-reimbursable keyword."""

    label: str
    amount: Decimal | None
    line: str


@dataclass
class ParsedReceipt:
    section: str = "other"  # lodging | transport | other
    head: str | None = None  # for "other": Meals / Miscellaneous
    merchant: str | None = None
    amount: Decimal | None = None
    bill_number: str | None = None
    expense_date: date | None = None
    check_in: date | None = None
    check_out: date | None = None
    nights: int | None = None
    expense_time: time | None = None
    city: str | None = None
    from_location: str | None = None
    to_location: str | None = None
    mode: str | None = None
    tax: Decimal = Decimal("0")
    flagged: list[FlaggedItem] = field(default_factory=list)
    confidence: str = "low"  # high | medium | low
    is_bill: bool = False  # has a total plus bill wording (invoice, GST, paid, …)
    travel_related: bool = False  # hotel, transport or meal wording found


def _has_word(text: str, word: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(word)}(?![a-z])", text) is not None


def _to_decimal(raw: str) -> Decimal | None:
    try:
        value = Decimal(raw.replace(",", ""))
    except InvalidOperation:
        return None
    return value if 0 < value <= MAX_AMOUNT else None


def _amounts_in(line: str) -> list[Decimal]:
    values = []
    for match in AMOUNT_RE.finditer(line):
        value = _to_decimal(match.group(1))
        if value is not None:
            values.append(value)
    return values


def find_total(lines: list[str]) -> Decimal | None:
    lowered = [line.lower() for line in lines]
    for keyword in TOTAL_KEYWORDS:
        # Bottom-most match: final totals are printed last
        for idx in range(len(lines) - 1, -1, -1):
            text = lowered[idx]
            if keyword not in text or any(skip in text for skip in NOT_TOTAL):
                continue
            amounts = _amounts_in(lines[idx])
            if not amounts and idx + 1 < len(lines):
                # Amount printed on the next line
                amounts = _amounts_in(lines[idx + 1])
            if amounts:
                return amounts[-1]
    # Fallback: largest ₹ / Rs amount on the receipt
    marked = [
        _to_decimal(m.group(1)) for m in CURRENCY_AMOUNT_RE.finditer("\n".join(lines))
    ]
    marked = [v for v in marked if v is not None]
    return max(marked) if marked else None


def _make_date(year: int, month: int, day: int) -> date | None:
    if year < 100:
        year += 2000
    try:
        value = date(year, month, day)
    except ValueError:
        return None
    return value if 2015 <= value.year <= 2100 else None


def dates_in(text: str) -> list[date]:
    """All dates in reading order (overlapping matches skipped)."""
    found: list[tuple[int, date]] = []
    taken: list[tuple[int, int]] = []
    for pattern, kind in DATE_PATTERNS:
        for match in pattern.finditer(text):
            start, end = match.span()
            if any(start < t_end and end > t_start for t_start, t_end in taken):
                continue
            g = match.groups()
            if kind == "ymd":
                value = _make_date(int(g[0]), int(g[1]), int(g[2]))
            elif kind == "dmy":
                day, month = int(g[0]), int(g[1])
                if month > 12 >= day:  # US-style 09/25/2026
                    day, month = month, day
                value = _make_date(int(g[2]), month, day)
            elif kind == "d_mon_y":
                value = _make_date(int(g[2]), MONTHS[g[1][:3].lower()], int(g[0]))
            else:
                value = _make_date(int(g[2]), MONTHS[g[0][:3].lower()], int(g[1]))
            if value:
                found.append((start, value))
                taken.append((start, end))
    return [value for _, value in sorted(found, key=lambda item: item[0])]


def _score(text: str, words: dict[str, int]) -> int:
    return sum(weight for word, weight in words.items() if _has_word(text, word))


def _merchant(lines: list[str]) -> str | None:
    for line in lines[:6]:
        cleaned = line.strip(" *-=_|:#.")
        letters = sum(ch.isalpha() for ch in cleaned)
        if letters < 3 or letters / max(len(cleaned), 1) < 0.5:
            continue
        if any(skip in cleaned.lower() for skip in MERCHANT_SKIP):
            continue
        return cleaned[:100]
    return None


def _transport_mode(text: str) -> str:
    if any(
        _has_word(text, w)
        for w in (
            "flight",
            "airline",
            "boarding",
            "indigo",
            "air india",
            "akasa",
            "spicejet",
            "vistara",
        )
    ):
        return "Flight"
    if any(_has_word(text, w) for w in ("irctc", "pnr", "train", "railway", "berth")):
        return "Rail"
    if any(_has_word(text, w) for w in ("bus", "redbus", "volvo")):
        return "Bus"
    if any(
        _has_word(text, w)
        for w in ("uber", "ola", "rapido", "meru", "cab", "taxi", "auto", "rickshaw")
    ):
        return "Cab"
    return "Other"


def _clean_place(value: str) -> str | None:
    # Drop trailing times / amounts that share the line
    value = re.sub(
        r"\s+(\d{1,2}:\d{2}.*|₹.*|rs\.?\s*\d.*)$", "", value, flags=re.IGNORECASE
    )
    value = value.strip(" ,.-:")
    return value[:120] or None


def _flagged_items(lines: list[str]) -> list[FlaggedItem]:
    items: list[FlaggedItem] = []
    for line in lines:
        text = line.lower()
        if any(k in text for k in ("total", "gstin")):
            continue
        for keyword, label in NON_REIMBURSABLE_KEYWORDS.items():
            if _has_word(text, keyword):
                amounts = _amounts_in(line)
                items.append(
                    FlaggedItem(
                        label, amounts[-1] if amounts else None, line.strip()[:120]
                    )
                )
                break
    return items


def _tax_total(lines: list[str]) -> Decimal:
    total = Decimal("0")
    for line in lines:
        text = line.lower()
        if (
            "gstin" in text
            or "total" in text
            or "incl" in text
            or not TAX_RE.search(text)
        ):
            continue
        amounts = _amounts_in(line)
        if amounts:
            total += amounts[-1]
    return total


def parse_receipt(text: str) -> ParsedReceipt:
    lines = [line for line in (raw.strip() for raw in text.splitlines()) if line]
    lowered = "\n".join(lines).lower()
    result = ParsedReceipt()
    if not lines:
        return result

    # categorise by keyword score (ties prefer lodging, then transport)
    scores = {
        "lodging": _score(lowered, LODGING_WORDS),
        "transport": _score(lowered, TRANSPORT_WORDS),
        "meals": _score(lowered, MEAL_WORDS),
    }
    best = max(scores, key=lambda k: scores[k])
    if scores[best] == 0:
        result.section, result.head = "other", "Miscellaneous"
    elif best == "meals":
        result.section, result.head = "other", "Meals"
    else:
        result.section = best

    # common fields
    result.merchant = _merchant(lines)
    result.amount = find_total(lines)
    for bill in BILL_RE.finditer("\n".join(lines)):
        if any(ch.isdigit() for ch in bill.group(1)):
            result.bill_number = bill.group(1)[:64]
            break
    result.tax = _tax_total(lines)
    all_dates = dates_in("\n".join(lines))
    result.expense_date = all_dates[0] if all_dates else None
    for key, canonical in TIER_1_CITIES.items():
        if _has_word(lowered, key):
            result.city = canonical
            break
    result.flagged = _flagged_items(lines)

    # section specific fields
    if result.section == "lodging":
        for line in lines:
            text = line.lower()
            line_dates = dates_in(line)
            if not line_dates:
                continue
            if any(
                k in text
                for k in ("arrival", "check-in", "check in", "checkin", "date in")
            ):
                result.check_in = result.check_in or line_dates[0]
            if any(
                k in text
                for k in ("departure", "check-out", "check out", "checkout", "date out")
            ):
                result.check_out = result.check_out or line_dates[-1]
        distinct = sorted(set(all_dates))
        if not result.check_in and distinct:
            result.check_in = distinct[0]
        if not result.check_out and len(distinct) > 1:
            result.check_out = distinct[-1]
        nights = NIGHTS_RE.search(lowered)
        result.nights = int(nights.group(1)) if nights else None
        result.expense_date = result.check_in
    elif result.section == "transport":
        result.mode = _transport_mode(lowered)
        time_match = TIME_RE.search(lowered)
        if time_match:
            hour, minute = int(time_match.group(1)), int(time_match.group(2))
            meridiem = (time_match.group(3) or "").lower()
            if meridiem == "pm" and hour < 12:
                hour += 12
            if meridiem == "am" and hour == 12:
                hour = 0
            if hour < 24 and minute < 60:
                result.expense_time = time(hour, minute)
        for line in lines:
            if m := FROM_TO_RE.search(line):
                result.from_location = result.from_location or _clean_place(m.group(1))
                result.to_location = result.to_location or _clean_place(m.group(2))
            elif m := PICKUP_RE.search(line):
                result.from_location = result.from_location or _clean_place(m.group(1))
            elif m := DROP_RE.search(line):
                result.to_location = result.to_location or _clean_place(m.group(1))

    # does it look like a bill at all, and like travel spend?
    bill_signals = sum(1 for word in BILL_WORDS if _has_word(lowered, word))
    bill_signals += 1 if CURRENCY_AMOUNT_RE.search(lowered) else 0
    result.is_bill = result.amount is not None and bill_signals >= 2
    result.travel_related = scores[best] >= 2

    # confidence: how much of the essentials we could read
    points = (
        (2 if result.amount else 0)
        + (1 if result.expense_date else 0)
        + (1 if scores[best] >= 2 else 0)
        + (1 if result.merchant else 0)
    )
    result.confidence = "high" if points >= 4 else "medium" if points >= 2 else "low"
    return result
