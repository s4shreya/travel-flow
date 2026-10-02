"""Helpers shared by request and settlement approval chains."""

from collections.abc import Iterable
from typing import TypeVar

from database.postgres.models.enums import ApprovalDecision

# TravelRequestApproval or TravelSettlementApproval (anything with a `decision`)
Step = TypeVar("Step")


def first_pending(steps: Iterable[Step]) -> Step | None:
    """Earliest pending step of an approval chain (steps are ordered by level), or None."""
    return next((s for s in steps if s.decision == ApprovalDecision.PENDING), None) 
