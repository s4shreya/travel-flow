"""Approval-matrix helpers for travel requests (policy NTX-HR-POL-11 §2)."""

from decimal import Decimal

from database.postgres.models.employee import Employee
from database.postgres.models.enums import EmployeeRole, TravelCategory
from database.postgres.crud.employee import EmployeeCRUD


# Amount thresholds in INR (inclusive upper bounds of each band use ">" cuts)
_BAND_HOD = Decimal("25000")
_BAND_HODIV = Decimal("75000")
_BAND_MD = Decimal("200000")


def required_approval_roles(
    estimated_cost: Decimal,
    travel_category: TravelCategory,
) -> list[EmployeeRole]:
    """
    Return business-approval roles for a travel request.

    International travel always requires the full chain through MD.
    Finance is not part of request approval — they disburse advance separately.
    """
    if travel_category == TravelCategory.INTERNATIONAL:
        return [
            EmployeeRole.REPORTING_MANAGER,
            EmployeeRole.HEAD_OF_DEPARTMENT,
            EmployeeRole.HEAD_OF_DIVISION,
            EmployeeRole.MD,
        ]

    roles: list[EmployeeRole] = [EmployeeRole.REPORTING_MANAGER]
    if estimated_cost > _BAND_HOD:
        roles.append(EmployeeRole.HEAD_OF_DEPARTMENT)
    if estimated_cost > _BAND_HODIV:
        roles.append(EmployeeRole.HEAD_OF_DIVISION)
    if estimated_cost > _BAND_MD:
        roles.append(EmployeeRole.MD)
    return roles


def resolve_approver_for_role(
    role: EmployeeRole,
    claimant: Employee,
    chain: list[Employee],
) -> Employee | None:
    """
    Pick the person who should act for `role`.

    - Reporting Manager → immediate manager
    - Other roles → first person up the chain with that role
    """
    if role == EmployeeRole.REPORTING_MANAGER:
        return chain[0] if chain else None

    for person in chain:
        if person.role == role:
            return person
    return None


def build_request_approval_plan(
    employee_crud: EmployeeCRUD,
    claimant: Employee,
    estimated_cost: Decimal,
    travel_category: TravelCategory,
) -> list[tuple[int, EmployeeRole, Employee | None, bool]]:
    """
    Build ordered approval steps.

    Each tuple: (level, role_required, approver | None, skipped).
    Self-approval levels are marked skipped (policy §2.2).
    """
    roles = required_approval_roles(estimated_cost, travel_category)
    chain = employee_crud.get_management_chain(claimant)

    plan: list[tuple[int, EmployeeRole, Employee | None, bool]] = []
    level = 1
    for role in roles:
        approver = resolve_approver_for_role(role, claimant, chain)
        # Policy §2.2 — claimant cannot approve their own request
        self_approve = claimant.role == role or (
            approver is not None and approver.id == claimant.id
        )
        if self_approve:
            plan.append((level, role, None, True))
        else:
            plan.append((level, role, approver, False))
        level += 1
    return plan
