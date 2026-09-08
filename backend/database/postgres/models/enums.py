from enum import StrEnum


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
