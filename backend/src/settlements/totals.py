"""Settlement totals — single source for every place."""

from decimal import Decimal

from database.postgres.models.enums import PaidBy
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement

ZERO = Decimal("0")


def expense_split(settlement: TravelSettlement) -> list[dict]:
    """Per section (lodging / transport / other): employee-paid, company-paid, disallowed."""
    split: dict[str, dict] = {}
    for line in settlement.expenses:
        section = line.section.value
        row = split.setdefault(
            section,
            {
                "section": section,
                "employee_paid": ZERO,
                "company_paid": ZERO,
                "disallowed": ZERO,
            },
        )
        if line.paid_by == PaidBy.EMPLOYEE:
            row["employee_paid"] += line.amount
            row["disallowed"] += line.disallowed_amount or ZERO
        else:
            row["company_paid"] += line.amount
    return list(split.values())


def recompute_settlement_totals(
    settlement: TravelSettlement, trip: TravelRequest
) -> None:
    employee_paid = ZERO
    company_paid = ZERO
    disallowed = ZERO
    for line in settlement.expenses:
        if line.paid_by == PaidBy.EMPLOYEE:
            employee_paid += line.amount
            # Disallowed = excess / non-reimbursable parts of employee-paid lines (policy §3.1, §4)
            disallowed += line.disallowed_amount or ZERO
        else:
            company_paid += line.amount

    net = max(employee_paid - disallowed, ZERO)
    # Full advance released — excess over net is recoverable from payroll
    advance = trip.advance_disbursed or ZERO
    balance = net - advance

    settlement.total_employee_paid = employee_paid
    settlement.total_company_paid = company_paid
    settlement.disallowed_total = disallowed
    settlement.net_reimbursable = net
    settlement.advance_applied = advance
    settlement.amount_payable = max(balance, ZERO)
    settlement.amount_recoverable = max(-balance, ZERO)
