from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from core.deps import get_current_employee
from core.exceptions import not_found
from database.postgres.models.employee import Employee
from database.postgres.models.notification import AppNotification
from database.postgres.session import get_db
from src.notifications.schemas import NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])

# The bell icon shows the most recent notifications only
NOTIFICATION_LIST_LIMIT = 50


@router.get("", response_model=list[NotificationRead], summary="List my notifications")
def list_notifications(
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> list[AppNotification]:
    stmt = (
        select(AppNotification)
        .where(AppNotification.employee_id == employee.id)
        .order_by(AppNotification.created_at.desc())
        .limit(NOTIFICATION_LIST_LIMIT)
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
        raise not_found("notification_not_found", "Notification not found")
    row.read = True
    db.commit()
    db.refresh(row)
    return row


@router.post("/read-all", response_model=list[NotificationRead])
def mark_all_read(
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> list[AppNotification]:
    # Mark every unread notification in one statement
    db.execute(
        update(AppNotification)
        .where(
            AppNotification.employee_id == employee.id,
            AppNotification.read.is_(False),
        )
        .values(read=True)
    )
    db.commit()
    return list_notifications(db, employee)
