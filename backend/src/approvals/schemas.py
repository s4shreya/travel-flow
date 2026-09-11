from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from database.postgres.models.enums import ApprovalDecision, EmployeeRole


class ApprovalDecideRequest(BaseModel):
    decision: ApprovalDecision
    remarks: str | None = Field(default=None, max_length=2000)


class ApprovalInboxItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    approval_id: int
    travel_request_id: str
    destination: str
    level: int
    role_required: EmployeeRole
    estimated_cost: str
    requester_employee_id: int
    created_at: datetime
