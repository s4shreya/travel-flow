"""Travel-desk bookings (policy §3.2): company-paid settlement lines seeded once a trip is approved."""

from datetime import date
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from core.expense_policy import LODGING_LIMIT_PER_NIGHT
from core.validators import PAISA
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ExpenseSection,
    PaidBy,
    SettlementStatus,
    TravelMode,
)
from database.postgres.models.travel_expense import (
    TravelExpense,
    TravelExpenseLodging,
    TravelExpenseTransport,
)
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement
from src.notifications.service import add_notification, settlement_href
from src.settlements.totals import recompute_settlement_totals

# Stable proof refs for the desk lines (employees cannot claim these)
PROOF_FLIGHT = "DESK-FLIGHT"  # onward leg (home city → destination)
PROOF_RETURN = "DESK-RETURN"  # return leg, same mode (destination → home city)
PROOF_HOTEL = "DESK-HOTEL"
DESK_PROOF_REFS = frozenset({PROOF_FLIGHT, PROOF_RETURN, PROOF_HOTEL})

# Estimate heads that price the bookings
TRANSPORT_HEAD_WORDS = (
    "flight",
    "airfare",
    "air",
    "rail",
    "train",
    "bus",
    "ticket",
    "transport",
)
HOTEL_HEAD_WORDS = ("hotel", "lodging", "stay", "accommodation")
# No transport head: assume this share of the estimate for the round trip
TRANSPORT_SHARE_OF_ESTIMATE = Decimal("0.35")


def is_desk_line(proof_ref: str | None) -> bool:
    return proof_ref in DESK_PROOF_REFS


def _head_amount(heads: list[dict], keywords: tuple[str, ...]) -> Decimal | None:
    """Amount of the first estimate head whose label mentions a keyword."""
    for head in heads or []:
        label = str(head.get("head") or "").lower()
        if any(word in label for word in keywords):
            try:
                return Decimal(str(head.get("amount") or "0"))
            except InvalidOperation:
                return None
    return None


def _transport_leg(
    trip: TravelRequest,
    *,
    proof_ref: str,
    on: date,
    from_city: str,
    to_city: str,
    amount: Decimal,
) -> TravelExpense:
    """One company-paid travel-desk leg in the trip's travel mode."""
    mode = trip.travel_mode.value if trip.travel_mode else TravelMode.FLIGHT.value
    return TravelExpense(
        section=ExpenseSection.TRANSPORT,
        expense_date=on,
        paid_by=PaidBy.COMPANY,
        amount=amount,
        proof_ref=proof_ref,
        transport=TravelExpenseTransport(
            expense_time=None,
            from_location=from_city,
            to_location=to_city,
            mode=mode,
        ),
    )


def _hotel(trip: TravelRequest) -> TravelExpense:
    """Company-paid hotel for the whole stay, priced from the estimate or the policy limit."""
    amount = _head_amount(trip.estimated_heads, HOTEL_HEAD_WORDS)
    if not amount:
        # Policy §3.1 lodging limit × nights
        nights = max((trip.end_date - trip.start_date).days, 1)
        amount = (LODGING_LIMIT_PER_NIGHT[trip.travel_category] * nights).quantize(
            PAISA
        )
    return TravelExpense(
        section=ExpenseSection.LODGING,
        expense_date=trip.start_date,
        paid_by=PaidBy.COMPANY,
        amount=amount,
        proof_ref=PROOF_HOTEL,
        lodging=TravelExpenseLodging(
            check_in=trip.start_date,
            check_out=trip.end_date,
            hotel_name=f"Travel desk hotel — {trip.destination}",
            city=trip.destination,
        ),
    )


def seed_desk_bookings(db: Session, trip: TravelRequest, employee: Employee) -> None:
    """
    Once the trip is approved the travel desk books onward + return travel (trip's mode)
    and the hotel. They start the settlement draft as company-paid lines; the employee
    adds everything else (cabs, meals, …). Saved by the caller's commit.
    """
    if trip.settlement is not None:
        return

    # get the round-trip transport amount and split it in half (return takes any odd paisa)
    round_trip = _head_amount(trip.estimated_heads, TRANSPORT_HEAD_WORDS)
    if not round_trip:
        round_trip = (trip.estimated_cost * TRANSPORT_SHARE_OF_ESTIMATE).quantize(PAISA)
    onward_amount = (round_trip / 2).quantize(PAISA)

    settlement = TravelSettlement(
        status=SettlementStatus.DRAFT,
        settlement_date=trip.start_date,
        expenses=[
            _transport_leg(
                trip,
                proof_ref=PROOF_FLIGHT,
                on=trip.start_date,
                from_city=employee.city,
                to_city=trip.destination,
                amount=onward_amount,
            ),
            _transport_leg(
                trip,
                proof_ref=PROOF_RETURN,
                on=trip.end_date,
                from_city=trip.destination,
                to_city=employee.city,
                amount=round_trip - onward_amount,
            ),
            _hotel(trip),
        ],
    )
    trip.settlement = settlement
    recompute_settlement_totals(settlement, trip)
    db.add(settlement)

    # tell the employee what is already booked
    add_notification(
        db,
        employee_id=employee.id,
        title="Travel desk booked travel and hotel",
        body=(
            f"Onward and return travel and the hotel for {trip.travel_request_id} "
            f"are booked by the travel desk. Add other expenses "
            f"(cabs, meals, etc.) in the settlement form."
        ),
        href=settlement_href(trip),
    )
