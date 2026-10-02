"""Approval-matrix helpers for travel requests (policy NTX-HR-POL-11 §2)."""

from decimal import Decimal

from database.postgres.models.employee import Employee
from database.postgres.models.enums import APPROVAL_LEVELS, EmployeeRole, TravelCategory
from database.postgres.crud.employee import EmployeeCRUD

# Amount thresholds in INR (inclusive upper bounds of each band use ">" cuts)
_BAND_HOD = Decimal("25000")
_BAND_HODIV = Decimal("75000")
_BAND_MD = Decimal("200000")

# One planned step: (level, role_required, approver | None, skipped)
ApprovalPlanStep = tuple[int, EmployeeRole, Employee | None, bool]


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
        return list(APPROVAL_LEVELS)

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
) -> list[ApprovalPlanStep]:
    """
    Build ordered approval steps.

    Policy §2.2: when the claimant holds a level (or nobody up the chain does) that
    level is skipped and the next level up acts. A person already approving an
    earlier level is not asked twice.
    """
    roles = required_approval_roles(estimated_cost, travel_category)
    chain = employee_crud.get_management_chain(claimant)

    plan: list[ApprovalPlanStep] = []
    assigned: set[int] = set()
    for index, role in enumerate(APPROVAL_LEVELS):
        if role not in roles:
            continue
        approver = resolve_approver_for_role(role, chain)
        if claimant.role == role or approver is None:
            plan.append((len(plan) + 1, role, None, True))
            # hand over to the next level up when it is not already required
            if index + 1 < len(APPROVAL_LEVELS) and APPROVAL_LEVELS[index + 1] not in roles:
                roles.append(APPROVAL_LEVELS[index + 1])
        elif approver.id in assigned:
            plan.append((len(plan) + 1, role, None, True))
        else:
            assigned.add(approver.id)
            plan.append((len(plan) + 1, role, approver, False))
    return plan
