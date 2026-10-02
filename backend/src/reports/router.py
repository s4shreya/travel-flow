from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.capabilities import Capability
from core.deps import require_capability
from core.exceptions import AppException
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.reports.schemas import ReportResponse
from src.reports.service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get(
    "",
    response_model=ReportResponse,
    summary="Organisation travel & expense report",
)
def get_report(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Employee, Depends(require_capability(Capability.VIEW_REPORTS))],
    date_from: Annotated[date | None, Query(description="Request raised on/after")] = None,
    date_to: Annotated[date | None, Query(description="Request raised on/before")] = None,
) -> ReportResponse:
    if date_from and date_to and date_from > date_to:
        raise AppException(
            status_code=422,
            sub_status_code="invalid_period",
            message="Start date must be on or before end date",
        )
    return ReportService(db).build(date_from, date_to)
