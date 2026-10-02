from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from core.deps import get_current_employee
from database.postgres.models.employee import Employee
from database.postgres.session import get_db
from src.receipts.schemas import ReceiptConfirmRequest, ReceiptExtraction, ReceiptRead
from src.receipts.service import MAX_RECEIPT_BYTES, ReceiptService
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
    # Read at most limit + 1 bytes so oversized uploads are rejected without buffering them
    data = await file.read(MAX_RECEIPT_BYTES + 1)
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


@router.get(
    "/{travel_request_id}/receipts/{receipt_id}/file",
    response_class=FileResponse,
    summary="View an uploaded receipt (inline)",
)
def receipt_file(
    travel_request_id: str,
    receipt_id: int,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> FileResponse:
    row, path = ReceiptService(db).get_receipt_file(employee, travel_request_id, receipt_id)
    # Type was detected from the file signature on upload; nosniff stops browsers guessing
    return FileResponse(
        path,
        media_type=row.content_type,
        filename=row.original_name,
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )


@router.delete(
    "/{travel_request_id}/receipts/{receipt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an uploaded receipt that is not on an expense",
)
def delete_receipt(
    travel_request_id: str,
    receipt_id: int,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> None:
    ReceiptService(db).delete(employee, travel_request_id, receipt_id)


@router.post(
    "/{travel_request_id}/receipts/{receipt_id}/extract",
    response_model=ReceiptExtraction,
    summary="OCR a receipt, suggest the expense line and check it against policy",
)
def extract_receipt(
    travel_request_id: str,
    receipt_id: int,
    db: Annotated[Session, Depends(get_db)],
    employee: Annotated[Employee, Depends(get_current_employee)],
) -> ReceiptExtraction:
    return ReceiptService(db).extract(employee, travel_request_id, receipt_id)


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
