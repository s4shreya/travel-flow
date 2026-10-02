from enum import StrEnum

from sqlalchemy import Enum


def str_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum_cls,
        name=name,
        values_callable=lambda cls: [member.value for member in cls],
        native_enum=False,
    )


class EmployeeRole(StrEnum):
    EMPLOYEE = "Employee"
    REPORTING_MANAGER = "Reporting Manager"
    HEAD_OF_DEPARTMENT = "Head of Department"
    HEAD_OF_DIVISION = "Head of Division"
    FINANCE = "Finance"
    MD = "MD"
    ADMIN = "Admin"


class TravelRequestStatus(StrEnum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    IN_SETTLEMENT = "in_settlement"
    CLOSED = "closed"


# Trips still moving through the flow (not draft, not closed)
OPEN_TRIP_STATUSES = frozenset(
    {
        TravelRequestStatus.PENDING_APPROVAL,
        TravelRequestStatus.APPROVED,
        TravelRequestStatus.IN_SETTLEMENT,
    }
)

class TravelCategory(StrEnum):
    DOMESTIC_TIER_1 = "Domestic - Tier 1"
    DOMESTIC_TIER_2 = "Domestic - Tier 2"
    DOMESTIC_TIER_3 = "Domestic - Tier 3"
    INTERNATIONAL = "International"


class TravelMode(StrEnum):
    FLIGHT = "Flight"
    RAIL = "Rail"
    ROAD = "Road"
    OTHER = "Other"


# Business approval levels
APPROVAL_LEVELS = (
    EmployeeRole.REPORTING_MANAGER,
    EmployeeRole.HEAD_OF_DEPARTMENT,
    EmployeeRole.HEAD_OF_DIVISION,
    EmployeeRole.MD,
)


class ApprovalDecision(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    RETURNED = "returned"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class SettlementStatus(StrEnum):
    DRAFT = "draft"
    RETURNED = "returned"
    FINANCE_REVIEW = "finance_review"
    QUEUED_FOR_PAYMENT = "queued_for_payment"
    PAID = "paid"
    RECOVERABLE = "recoverable"


# Submitted to Finance (counts as a claim); draft / returned are still with the employee
SUBMITTED_SETTLEMENT_STATUSES = frozenset(
    {
        SettlementStatus.FINANCE_REVIEW,
        SettlementStatus.QUEUED_FOR_PAYMENT,
        SettlementStatus.RECOVERABLE,
        SettlementStatus.PAID,
    }
)
# Finance has approved the amounts
APPROVED_SETTLEMENT_STATUSES = frozenset(
    {
        SettlementStatus.QUEUED_FOR_PAYMENT,
        SettlementStatus.RECOVERABLE,
        SettlementStatus.PAID,
    }
)
# Waiting on Finance to pay out or note a payroll recovery
PAYMENT_DUE_STATUSES = frozenset(
    {SettlementStatus.QUEUED_FOR_PAYMENT, SettlementStatus.RECOVERABLE}
)


class ExpenseSection(StrEnum):
    LODGING = "lodging"
    TRANSPORT = "transport"
    OTHER = "other"


class PaidBy(StrEnum):
    EMPLOYEE = "Employee"
    COMPANY = "Company"
