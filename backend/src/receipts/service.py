import re
import uuid
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import logger
from core.exceptions import AppException
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ExpenseSection,
    PaidBy,
    SettlementStatus,
)
from database.postgres.models.travel_receipt import TravelReceipt
from database.postgres.models.travel_request import TravelRequest
from src.receipts.ocr import extract_text
from src.receipts.parser import parse_receipt
from src.receipts.policy_checks import check_receipt, evidence_check
from src.receipts.schemas import (
    PolicyFindingRead,
    ReceiptConfirmRequest,
    ReceiptExtraction,
    ReceiptSuggestion,
)
from src.settlements.schemas import SettlementRead
from src.settlements.service import SettlementService
from src.travel_requests.service import TravelRequestService, assert_settlement_open

# Store uploads next to the backend package
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"

# Upload limits
MAX_RECEIPT_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_RECEIPTS_PER_REQUEST = 50

# Allowed formats, detected from file signature (never trust the client's type)
_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"%PDF-", "application/pdf", ".pdf"),
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
)


def detect_file_type(data: bytes) -> tuple[str, str] | None:
    """Return (content_type, extension) for an allowed receipt format."""
    for magic, content_type, ext in _SIGNATURES:
        if data.startswith(magic):
            return content_type, ext
    # WEBP: "RIFF" .... "WEBP"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", ".webp"
    return None


def safe_display_name(filename: str, ext: str) -> str:
    """Strip paths and odd characters from the user's filename (display only)."""
    base = Path(filename.replace("\\", "/")).name
    stem = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(base).stem).strip(" ._") or "receipt"
    return f"{stem[:100]}{ext}"


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
        # Bills open with the settlement: trip approved and the advance step over
        assert_settlement_open(trip)

        # Validate the file itself
        if not data:
            raise AppException(
                status_code=422,
                sub_status_code="empty_file",
                message="The uploaded file is empty",
            )
        if len(data) > MAX_RECEIPT_BYTES:
            raise AppException(
                status_code=413,
                sub_status_code="file_too_large",
                message="Receipt must be 5 MB or smaller",
            )
        detected = detect_file_type(data)
        if detected is None:
            raise AppException(
                status_code=415,
                sub_status_code="unsupported_file_type",
                message="Only PDF, JPG, PNG or WEBP receipts are allowed",
            )
        detected_type, ext = detected

        # Cap receipts per trip
        count = self.db.execute(
            select(func.count()).select_from(TravelReceipt).where(
                TravelReceipt.travel_request_id == trip.id
            )
        ).scalar_one()
        if count >= MAX_RECEIPTS_PER_REQUEST:
            raise AppException(
                status_code=422,
                sub_status_code="too_many_receipts",
                message=f"A travel request can have at most {MAX_RECEIPTS_PER_REQUEST} receipts",
            )

        # Server-generated name on disk; the user's filename is display-only
        folder = UPLOAD_ROOT / trip.travel_request_id
        folder.mkdir(parents=True, exist_ok=True)
        stored = f"{uuid.uuid4().hex}{ext}"
        path = folder / stored
        path.write_bytes(data)

        row = TravelReceipt(
            travel_request_id=trip.id,
            stored_name=stored,
            original_name=safe_display_name(filename, ext),
            content_type=detected_type,
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
        return trip, self._receipt_on_trip(trip, receipt_id)

    def get_receipt_file(
        self, employee: Employee, travel_request_id: str, receipt_id: int
    ) -> tuple[TravelReceipt, Path]:
        """Receipt + file on disk for anyone who may view the trip (requester, approvers, Finance)."""
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        row = self._receipt_on_trip(trip, receipt_id)
        return row, self._existing_path(trip, row)

    def _receipt_on_trip(self, trip: TravelRequest, receipt_id: int) -> TravelReceipt:
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
        return row

    def delete(self, employee: Employee, travel_request_id: str, receipt_id: int) -> None:
        """Delete an unclaimed bill (row + file) while the settlement is still editable."""
        trip, row = self.get_owned_receipt(employee, travel_request_id, receipt_id)
        assert_settlement_open(trip)

        # a submitted claim keeps its evidence; a claimed bill goes with its expense first
        settlement = self.settlements._load_for_trip(trip.id)
        if settlement is not None:
            if settlement.status not in {SettlementStatus.DRAFT, SettlementStatus.RETURNED}:
                raise AppException(
                    status_code=422,
                    sub_status_code="settlement_locked",
                    message="This settlement can no longer be edited",
                )
            if any(exp.proof_ref == str(row.id) for exp in settlement.expenses):
                raise AppException(
                    status_code=409,
                    sub_status_code="receipt_in_use",
                    message="This bill is on an expense. Remove the expense first.",
                )

        # remove the row, then the file (stored under a server-generated name)
        path = UPLOAD_ROOT / trip.travel_request_id / row.stored_name
        self.db.delete(row)
        self.db.commit()
        path.unlink(missing_ok=True)

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

    def extract(
        self, employee: Employee, travel_request_id: str, receipt_id: int
    ) -> ReceiptExtraction:
        """OCR the receipt, categorise it and check it against the expense policy."""
        trip, row = self.get_owned_receipt(employee, travel_request_id, receipt_id)
        path = self._existing_path(trip, row)

        # read the text, then categorise it with rules
        text = extract_text(path, row.content_type)
        parsed = parse_receipt(text)
        logger.info(
            f"OCR receipt {row.id} for {trip.travel_request_id}: section={parsed.section} "
            f"amount={parsed.amount} confidence={parsed.confidence}"
        )

        # is it a bill for this trip at all?
        evidence, evidence_note = evidence_check(parsed, text, row.original_name)

        # check against policy using the lines already on the settlement
        settlement = self.settlements._load_for_trip(trip.id)
        existing = list(settlement.expenses) if settlement else []
        policy = check_receipt(parsed, trip, existing)
        # policy findings mean nothing for a file that isn't a bill
        findings = [] if evidence == "not_receipt" else policy.findings

        # build the pre-filled form
        description = " · ".join(
            part for part in (parsed.merchant, f"Bill {parsed.bill_number}" if parsed.bill_number else None) if part
        )
        suggestion = ReceiptSuggestion(
            section=ExpenseSection(parsed.section),
            paid_by=policy.paid_by,
            amount=parsed.amount,
            check_in=parsed.check_in,
            check_out=parsed.check_out,
            hotel_name=parsed.merchant if parsed.section == "lodging" else None,
            # Fall back to the trip destination for the hotel city
            city=(parsed.city or trip.destination) if parsed.section == "lodging" else None,
            expense_date=parsed.expense_date,
            expense_time=parsed.expense_time,
            from_location=parsed.from_location,
            to_location=parsed.to_location,
            mode=parsed.mode,
            head=parsed.head,
            description=description[:1000] or None,
            disallowed_amount=policy.disallowed if policy.paid_by == PaidBy.EMPLOYEE else Decimal("0"),
            disallow_reason="; ".join(policy.reasons)[:255] or None,
        )
        return ReceiptExtraction(
            receipt_id=row.id,
            confidence=parsed.confidence,
            evidence=evidence,
            evidence_note=evidence_note,
            merchant=parsed.merchant,
            bill_number=parsed.bill_number,
            suggestion=suggestion,
            findings=[PolicyFindingRead(**vars(f)) for f in findings],
            text=text.strip()[:4000],
        )

    def _existing_path(self, trip: TravelRequest, receipt: TravelReceipt) -> Path:
        # Stored under a server-generated name, so no user input reaches the path
        path = UPLOAD_ROOT / trip.travel_request_id / receipt.stored_name
        if not path.is_file():
            raise AppException(
                status_code=404,
                sub_status_code="receipt_file_missing",
                message="The receipt file could not be found. Please upload it again.",
            )
        return path
