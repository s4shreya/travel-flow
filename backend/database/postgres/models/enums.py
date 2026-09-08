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


class TravelRequestStatus(StrEnum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    IN_SETTLEMENT = "in_settlement"
    CLOSED = "closed"


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


# Roles allowed on an approval step
APPROVER_ROLES = frozenset(
    {
        EmployeeRole.REPORTING_MANAGER,
        EmployeeRole.HEAD_OF_DEPARTMENT,
        EmployeeRole.HEAD_OF_DIVISION,
        EmployeeRole.FINANCE,
        EmployeeRole.MD,
    }
)


class ApprovalDecision(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    RETURNED = "returned"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class SettlementStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    RETURNED = "returned"
    IN_APPROVAL = "in_approval"
    FINANCE_REVIEW = "finance_review"
    QUEUED_FOR_PAYMENT = "queued_for_payment"
    PAID = "paid"
    RECOVERABLE = "recoverable"


class ExpenseSection(StrEnum):
    LODGING = "lodging"
    TRANSPORT = "transport"
    OTHER = "other"


class PaidBy(StrEnum):
    EMPLOYEE = "Employee"
    COMPANY = "Company"
