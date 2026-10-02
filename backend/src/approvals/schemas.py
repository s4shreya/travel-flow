from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from database.postgres.models.enums import ApprovalDecision, EmployeeRole
from src.travel_requests.schemas import ApprovalStepRead

# What an approval step belongs to
KIND_TRAVEL_REQUEST = "travel_request"
KIND_SETTLEMENT = "settlement"
ApprovalKind = Literal["travel_request", "settlement"]


class ApprovalDecideRequest(BaseModel):
    decision: ApprovalDecision
    remarks: str | None = Field(default=None, max_length=2000)
    kind: ApprovalKind = KIND_TRAVEL_REQUEST


class ApprovalInboxItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: ApprovalKind = KIND_TRAVEL_REQUEST
    approval_id: int
    travel_request_id: str
    destination: str
    level: int
    role_required: EmployeeRole
    amount: str
    requester_employee_id: int
    requester_name: str
    created_at: datetime
    # Whole chain (request or settlement), so the inbox can show every level
    approvals: list[ApprovalStepRead] = Field(default_factory=list)
