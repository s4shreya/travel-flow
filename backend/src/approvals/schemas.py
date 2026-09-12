from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from database.postgres.models.enums import ApprovalDecision, EmployeeRole


class ApprovalDecideRequest(BaseModel):
    decision: ApprovalDecision
    remarks: str | None = Field(default=None, max_length=2000)
    kind: Literal["travel_request", "settlement"] = "travel_request"


class ApprovalInboxItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: Literal["travel_request", "settlement"] = "travel_request"
    approval_id: int
    travel_request_id: str
    destination: str
    level: int
    role_required: EmployeeRole
    amount: str
    requester_employee_id: int
    created_at: datetime
