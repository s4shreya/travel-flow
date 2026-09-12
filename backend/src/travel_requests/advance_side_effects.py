"""Seed desk bookings + notify employee when advance funds are released."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ExpenseSection,
    PaidBy,
    SettlementStatus,
    TravelCategory,
    TravelMode,
)
from database.postgres.models.notification import AppNotification
from database.postgres.models.travel_expense import (
    TravelExpense,
    TravelExpenseLodging,
    TravelExpenseTransport,
)
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement

# Stable proof refs so we only seed once per trip
PROOF_FLIGHT = "DESK-FLIGHT"
PROOF_HOTEL = "DESK-HOTEL"

TIER_LODGING_PER_NIGHT = {
    TravelCategory.DOMESTIC_TIER_1: Decimal("6000"),
    TravelCategory.DOMESTIC_TIER_2: Decimal("4000"),
    TravelCategory.DOMESTIC_TIER_3: Decimal("2800"),
    TravelCategory.INTERNATIONAL: Decimal("6000"),
}


def _head_amount(heads: list[dict], keywords: tuple[str, ...]) -> Decimal | None:
    for head in heads or []:
        label = str(head.get("head") or "").lower()
        if any(word in label for word in keywords):
            try:
                return Decimal(str(head.get("amount") or "0"))
            except Exception:
                return None
    return None


def _load_settlement(db: Session, trip_pk: int) -> TravelSettlement | None:
    stmt = (
        select(TravelSettlement)
        .where(TravelSettlement.travel_request_id == trip_pk)
        .options(selectinload(TravelSettlement.expenses))
    )
    return db.execute(stmt).scalar_one_or_none()


def seed_bookings_and_notify(
    db: Session,
    trip: TravelRequest,
    employee: Employee,
    *,
    advance_amount: Decimal,
    reference: str,
) -> None:
    """
    After funds release:
    - Travel desk books flight and hotel — always Company-paid
    - Employee later adds other expenses (cabs, meals, etc.) themselves
    - Notify separately: advance released, and desk bookings on settlement
    """
    settlement = _load_settlement(db, trip.id)
    already = {
        (exp.proof_ref or "")
        for exp in (settlement.expenses if settlement else [])
    }
    if PROOF_FLIGHT in already and PROOF_HOTEL in already:
        # Desk hotel/flight are always company-paid — correct any older seed
        changed = False
        for exp in settlement.expenses:  # type: ignore[union-attr]
            if (
                exp.proof_ref in {PROOF_FLIGHT, PROOF_HOTEL}
                and exp.paid_by != PaidBy.COMPANY
            ):
                exp.paid_by = PaidBy.COMPANY
                changed = True
        if changed and settlement is not None:
            _recompute_settlement_totals(settlement, trip)
            db.add(settlement)
        _ensure_release_notifications(
            db, trip, employee, advance_amount=advance_amount, reference=reference
        )
        return

    if settlement is None:
        settlement = TravelSettlement(
            travel_request_id=trip.id,
            status=SettlementStatus.DRAFT,
            settlement_date=trip.start_date,
        )
        db.add(settlement)
        db.flush()

    nights = max((trip.end_date - trip.start_date).days, 1)
    heads = list(trip.estimated_heads or [])

    # Flight / primary mode — travel desk, always company-paid
    if PROOF_FLIGHT not in already:
        mode = trip.travel_mode.value if trip.travel_mode else TravelMode.FLIGHT.value
        flight_amount = _head_amount(
            heads, ("flight", "airfare", "air", "rail", "ticket", "transport")
        )
        if flight_amount is None:
            flight_amount = (trip.estimated_cost * Decimal("0.35")).quantize(
                Decimal("0.01")
            )
        settlement.expenses.append(
            TravelExpense(
                section=ExpenseSection.TRANSPORT,
                expense_date=trip.start_date,
                paid_by=PaidBy.COMPANY,
                amount=flight_amount,
                proof_ref=PROOF_FLIGHT,
                transport=TravelExpenseTransport(
                    expense_time=None,
                    from_location=employee.city,
                    to_location=trip.destination,
                    mode=mode,
                ),
            )
        )

    # Hotel — travel desk, always company-paid
    if PROOF_HOTEL not in already:
        hotel_amount = _head_amount(heads, ("hotel", "lodging", "stay", "accommodation"))
        if hotel_amount is None:
            per_night = TIER_LODGING_PER_NIGHT.get(
                trip.travel_category, Decimal("2800")
            )
            hotel_amount = (per_night * nights).quantize(Decimal("0.01"))
        settlement.expenses.append(
            TravelExpense(
                section=ExpenseSection.LODGING,
                expense_date=trip.start_date,
                paid_by=PaidBy.COMPANY,
                amount=hotel_amount,
                proof_ref=PROOF_HOTEL,
                lodging=TravelExpenseLodging(
                    check_in=trip.start_date,
                    check_out=trip.end_date,
                    hotel_name=f"Travel desk hotel — {trip.destination}",
                    city=trip.destination,
                ),
            )
        )

    # Recompute settlement totals with advance
    _recompute_settlement_totals(settlement, trip)
    settlement.status = SettlementStatus.DRAFT
    db.add(settlement)

    _ensure_release_notifications(
        db, trip, employee, advance_amount=advance_amount, reference=reference
    )


def _recompute_settlement_totals(
    settlement: TravelSettlement, trip: TravelRequest
) -> None:
    employee_paid = Decimal("0")
    company_paid = Decimal("0")
    for line in settlement.expenses:
        if line.paid_by == PaidBy.EMPLOYEE:
            employee_paid += line.amount
        else:
            company_paid += line.amount
    net = employee_paid
    # Full advance released — excess over net is recoverable from payroll
    advance = trip.advance_disbursed or Decimal("0")
    balance = net - advance
    settlement.total_employee_paid = employee_paid
    settlement.total_company_paid = company_paid
    settlement.disallowed_total = Decimal("0")
    settlement.net_reimbursable = net
    settlement.advance_applied = advance
    settlement.amount_payable = balance if balance > 0 else Decimal("0")
    settlement.amount_recoverable = abs(balance) if balance < 0 else Decimal("0")


def _ensure_release_notifications(
    db: Session,
    trip: TravelRequest,
    employee: Employee,
    *,
    advance_amount: Decimal,
    reference: str,
) -> None:
    """Create two distinct notifications (advance + desk bookings), once each."""
    request_href = f"/travel-requests/{trip.travel_request_id}"
    settlement_href = f"/travel-requests/{trip.travel_request_id}/settlement"

    _add_notification_once(
        db,
        employee_id=employee.id,
        title="Advance released",
        body=(
            f"Finance released advance ₹{advance_amount} ({reference}) for "
            f"{trip.travel_request_id}."
        ),
        href=request_href,
    )
    _add_notification_once(
        db,
        employee_id=employee.id,
        title="Travel desk booked flight and hotel",
        body=(
            f"Flight and hotel for {trip.travel_request_id} are booked by "
            f"the travel desk. Add other expenses "
            f"(cabs, meals, etc.) in the settlement form."
        ),
        href=settlement_href,
    )


def add_notification_once(
    db: Session,
    *,
    employee_id: int,
    title: str,
    body: str,
    href: str,
) -> None:
    # Avoid duplicate prompts for the same trip + title
    existing = db.execute(
        select(AppNotification).where(
            AppNotification.employee_id == employee_id,
            AppNotification.href == href,
            AppNotification.title == title,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return

    db.add(
        AppNotification(
            employee_id=employee_id,
            title=title,
            body=body,
            href=href,
            read=False,
        )
    )


def _add_notification_once(
    db: Session,
    *,
    employee_id: int,
    title: str,
    body: str,
    href: str,
) -> None:
    add_notification_once(
        db, employee_id=employee_id, title=title, body=body, href=href
    )


def notify_settlement_funds_released(
    db: Session,
    trip: TravelRequest,
    *,
    amount_payable: Decimal,
    amount_recoverable: Decimal,
    was_recovery: bool,
) -> None:
    """Notify the requester after Finance closes settlement payment/recovery."""
    settlement_href = f"/travel-requests/{trip.travel_request_id}/settlement"
    if was_recovery or (amount_recoverable > 0 and amount_payable <= 0):
        title = "Settlement recovery noted"
        body = (
            f"Finance closed settlement for {trip.travel_request_id}. "
            f"Excess advance ₹{amount_recoverable} will be recovered from payroll."
        )
    else:
        title = "Settlement payment released"
        body = (
            f"Finance released settlement funds ₹{amount_payable} for "
            f"{trip.travel_request_id}. Your travel request is now closed."
        )
    add_notification_once(
        db,
        employee_id=trip.employee_id,
        title=title,
        body=body,
        href=settlement_href,
    )
