"""Role → capability map."""

from enum import StrEnum

from database.postgres.models.enums import EmployeeRole


class Capability(StrEnum):
    CREATE_REQUEST = "create_request"
    TRACK_REQUESTS = "track_requests"
    APPROVE_REQUESTS = "approve_requests"
    RELEASE_FUNDS = "release_funds"


# Shared employee actions
_BASE = (Capability.CREATE_REQUEST, Capability.TRACK_REQUESTS)

_BY_ROLE: dict[EmployeeRole, tuple[Capability, ...]] = {
    EmployeeRole.EMPLOYEE: _BASE,
    EmployeeRole.REPORTING_MANAGER: (*_BASE, Capability.APPROVE_REQUESTS),
    EmployeeRole.HEAD_OF_DEPARTMENT: (*_BASE, Capability.APPROVE_REQUESTS),
    EmployeeRole.HEAD_OF_DIVISION: (*_BASE, Capability.APPROVE_REQUESTS),
    EmployeeRole.MD: (*_BASE, Capability.APPROVE_REQUESTS),
    EmployeeRole.FINANCE: (*_BASE, Capability.RELEASE_FUNDS, Capability.APPROVE_REQUESTS),
}


def capabilities_for_role(role: EmployeeRole) -> list[Capability]:
    return list(_BY_ROLE.get(role, _BASE))


def has_capability(role: EmployeeRole, capability: Capability) -> bool:
    return capability in _BY_ROLE.get(role, _BASE)
