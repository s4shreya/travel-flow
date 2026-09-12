from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.deps import get_current_employee
from core.exceptions import AppException
from database.postgres.models.employee import Employee
from database.postgres.models.notification import AppNotification
from database.postgres.session import get_db
from datetime import datetime

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    href: str | None
    read: bool
    created_at: datetime


@router.get("", response_model=list[NotificationRead], summary="List my notifications")
def list_notifications(
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> list[AppNotification]:
    stmt = (
        select(AppNotification)
        .where(AppNotification.employee_id == employee.id)
        .order_by(AppNotification.created_at.desc())
    )
    return list(db.execute(stmt).scalars().all())


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> AppNotification:
    row = db.execute(
        select(AppNotification).where(
            AppNotification.id == notification_id,
            AppNotification.employee_id == employee.id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise AppException(
            status_code=404,
            sub_status_code="notification_not_found",
            message="Notification not found",
        )
    row.read = True
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/read-all", response_model=list[NotificationRead])
def mark_all_read(
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> list[AppNotification]:
    stmt = select(AppNotification).where(
        AppNotification.employee_id == employee.id,
        AppNotification.read.is_(False),
    )
    rows = list(db.execute(stmt).scalars().all())
    for row in rows:
        row.read = True
        db.add(row)
    db.commit()
    return list_notifications(db, employee)
