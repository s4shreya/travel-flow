import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException
from database.postgres.models.employee import Employee
from database.postgres.models.enums import TravelRequestStatus
from database.postgres.models.travel_receipt import TravelReceipt
from database.postgres.models.travel_request import TravelRequest
from src.receipts.schemas import ReceiptConfirmRequest
from src.settlements.schemas import SettlementRead
from src.settlements.service import SettlementService
from src.travel_requests.service import TravelRequestService

# Store uploads next to the backend package
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"


class ReceiptService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.trips = TravelRequestService(db)
        self.settlements = SettlementService(db)

    def list_for_request(
        self, employee: Employee, travel_request_id: str
    ) -> list[tuple[TravelReceipt, str]]:
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        stmt = (
            select(TravelReceipt)
            .where(TravelReceipt.travel_request_id == trip.id)
            .order_by(TravelReceipt.created_at.desc())
        )
        rows = list(self.db.execute(stmt).scalars().all())
        return [(row, trip.travel_request_id) for row in rows]

    def upload(
        self,
        employee: Employee,
        travel_request_id: str,
        *,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> tuple[TravelReceipt, str]:
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        if trip.employee_id != employee.id:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="Only the requester can upload receipts",
            )
        if trip.status not in {
            TravelRequestStatus.APPROVED,
            TravelRequestStatus.IN_SETTLEMENT,
        }:
            raise AppException(
                status_code=422,
                sub_status_code="receipts_not_allowed",
                message="Receipts can only be uploaded for approved trips",
            )

        folder = UPLOAD_ROOT / trip.travel_request_id
        folder.mkdir(parents=True, exist_ok=True)
        stored = f"{uuid.uuid4().hex}_{filename}"
        path = folder / stored
        path.write_bytes(data)

        row = TravelReceipt(
            travel_request_id=trip.id,
            stored_name=stored,
            original_name=filename,
            content_type=content_type or "application/octet-stream",
            size_bytes=len(data),
            uploaded_by_id=employee.id,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row, trip.travel_request_id

    def get_owned_receipt(
        self, employee: Employee, travel_request_id: str, receipt_id: int
    ) -> tuple[TravelRequest, TravelReceipt]:
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        if trip.employee_id != employee.id:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="Only the requester can manage receipts",
            )
        stmt = select(TravelReceipt).where(
            TravelReceipt.id == receipt_id,
            TravelReceipt.travel_request_id == trip.id,
        )
        row = self.db.execute(stmt).scalar_one_or_none()
        if row is None:
            raise AppException(
                status_code=404,
                sub_status_code="receipt_not_found",
                message=f"Receipt not found: {receipt_id}",
            )
        return trip, row

    def confirm(
        self,
        employee: Employee,
        travel_request_id: str,
        receipt_id: int,
        payload: ReceiptConfirmRequest,
    ) -> SettlementRead:
        # Link the manual expense line to this receipt as proof
        _, row = self.get_owned_receipt(employee, travel_request_id, receipt_id)
        expense = payload.to_expense(proof_ref=str(row.id))
        return self.settlements.append_expense(
            employee, travel_request_id, expense
        )

    def absolute_path(self, trip: TravelRequest, receipt: TravelReceipt) -> Path:
        return UPLOAD_ROOT / trip.travel_request_id / receipt.stored_name
