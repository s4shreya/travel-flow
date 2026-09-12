from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from core.deps import get_current_employee
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.receipts.schemas import ReceiptConfirmRequest, ReceiptRead
from src.receipts.service import ReceiptService
from src.settlements.schemas import SettlementRead

router = APIRouter(prefix="/travel-requests", tags=["receipts"])


@router.get(
    "/{travel_request_id}/receipts",
    response_model=list[ReceiptRead],
    summary="List receipts for a travel request",
)
def list_receipts(
    travel_request_id: str,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> list[ReceiptRead]:
    rows = ReceiptService(db).list_for_request(employee, travel_request_id)
    return [
        ReceiptRead(
            id=row.id,
            travel_request_id=business_id,
            original_name=row.original_name,
            content_type=row.content_type,
            size_bytes=row.size_bytes,
            created_at=row.created_at,
        )
        for row, business_id in rows
    ]


@router.post(
    "/{travel_request_id}/receipts",
    response_model=ReceiptRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a receipt for a travel request",
)
async def upload_receipt(
    travel_request_id: str,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
    file: UploadFile = File(...),
) -> ReceiptRead:
    data = await file.read()
    row, business_id = ReceiptService(db).upload(
        employee,
        travel_request_id,
        filename=file.filename or "receipt.bin",
        content_type=file.content_type or "application/octet-stream",
        data=data,
    )
    return ReceiptRead(
        id=row.id,
        travel_request_id=business_id,
        original_name=row.original_name,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        created_at=row.created_at,
    )


@router.post(
    "/{travel_request_id}/receipts/{receipt_id}/confirm",
    response_model=SettlementRead,
    summary="Save a manual expense line linked to this receipt",
)
def confirm_receipt(
    travel_request_id: str,
    receipt_id: int,
    payload: ReceiptConfirmRequest,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> SettlementRead:
    return ReceiptService(db).confirm(
        employee, travel_request_id, receipt_id, payload
    )
