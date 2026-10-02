from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.exceptions import AppException, forbidden, not_found
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    PAYMENT_DUE_STATUSES,
    ApprovalDecision,
    EmployeeRole,
    ExpenseSection,
    SettlementStatus,
    TravelRequestStatus,
)
from database.postgres.models.travel_approvals import TravelSettlementApproval
from database.postgres.models.travel_expense import (
    TravelExpense,
    TravelExpenseLodging,
    TravelExpenseOther,
    TravelExpenseTransport,
)
from database.postgres.models.travel_receipt import TravelReceipt
from database.postgres.models.travel_request import TravelRequest
from database.postgres.models.travel_settlement import TravelSettlement
from src.notifications.service import (
    add_notification,
    notify_current_approver,
    notify_settlement_closed,
    settlement_href,
)
from src.settlements.schemas import SettlementExpenseIn, SettlementRead, SettlementSave
from src.settlements.totals import ZERO, recompute_settlement_totals
from src.travel_requests.desk_bookings import is_desk_line
from src.travel_requests.schemas import FinanceRemarksRequest
from src.travel_requests.service import (
    TravelRequestService,
    assert_not_own_trip,
    assert_settlement_open,
)

# Allow one travel day before / after the trip window
TRIP_DATE_BUFFER_DAYS = 1

# Settlement states the employee can still edit
_EDITABLE_STATUSES = frozenset({SettlementStatus.DRAFT, SettlementStatus.RETURNED})


class SettlementService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.employees = EmployeeCRUD(db)
        self.trips = TravelRequestService(db)

    def get(
        self, employee: Employee, travel_request_id: str
    ) -> SettlementRead | None:
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        settlement = self._load_for_trip(trip.id)
        if settlement is None:
            return None
        return self._to_read(settlement, trip.travel_request_id)

    def save(
        self,
        employee: Employee,
        travel_request_id: str,
        payload: SettlementSave,
    ) -> SettlementRead:
        trip, settlement = self._load_editable(employee, travel_request_id)

        desk_lines = [exp for exp in settlement.expenses if is_desk_line(exp.proof_ref)]
        claim_lines = [line for line in payload.expenses if not is_desk_line(line.proof_ref)]

        # One receipt can back only one claim line
        self._assert_unique_proofs([line.proof_ref for line in claim_lines])

        # Replace the employee's lines
        settlement.expenses[:] = desk_lines
        self.db.flush()
        for line in claim_lines:
            self._assert_proof_for_trip(trip, line.proof_ref)
            self._assert_within_trip(trip, line)
            settlement.expenses.append(self._build_expense(line))

        recompute_settlement_totals(settlement, trip)
        settlement.settlement_date = payload.settlement_date or date.today()
        settlement.status = SettlementStatus.DRAFT

        if payload.submit:
            self._submit(settlement, trip, employee)

        return self._commit(settlement, trip)

    def append_expense(
        self,
        employee: Employee,
        travel_request_id: str,
        line: SettlementExpenseIn,
    ) -> SettlementRead:
        """Add one confirmed receipt line onto the settlement draft."""
        trip, settlement = self._load_editable(employee, travel_request_id)

        self._assert_unique_proofs(
            [exp.proof_ref for exp in settlement.expenses] + [line.proof_ref]
        )
        self._assert_proof_for_trip(trip, line.proof_ref)
        self._assert_within_trip(trip, line)
        settlement.expenses.append(self._build_expense(line))
        recompute_settlement_totals(settlement, trip)
        settlement.settlement_date = settlement.settlement_date or date.today()
        settlement.status = SettlementStatus.DRAFT
        return self._commit(settlement, trip)

    def return_to_employee(
        self, employee: Employee, travel_request_id: str, payload: FinanceRemarksRequest
    ) -> SettlementRead:
        # Finance sends the claim back for correction (same as an approver return)
        trip, settlement = self._load_for_finance(employee, travel_request_id)
        settlement.status = SettlementStatus.RETURNED
        trip.status = TravelRequestStatus.APPROVED
        # Record the return on the chain so the employee sees who and why
        settlement.approvals.append(
            TravelSettlementApproval(
                level=len(settlement.approvals) + 1,
                role_required=EmployeeRole.FINANCE,
                approver_id=employee.id,
                decision=ApprovalDecision.RETURNED,
                remarks=payload.remarks,
                decided_at=datetime.now(timezone.utc),
            )
        )
        add_notification(
            self.db,
            employee_id=trip.employee_id,
            title="Settlement returned by Finance",
            body=(
                f"{trip.travel_request_id} was returned by {employee.name}. "
                f'Remarks: "{payload.remarks}". Update your expenses and submit again.'
            ),
            href=settlement_href(trip),
        )
        return self._commit(settlement, trip)

    def mark_paid(
        self, employee: Employee, travel_request_id: str
    ) -> SettlementRead:
        # Finance marks payment / recovery complete
        trip, settlement = self._load_for_finance(employee, travel_request_id)
        settlement.status = SettlementStatus.PAID
        trip.status = TravelRequestStatus.CLOSED
        # Notify the requester (not Finance)
        notify_settlement_closed(
            self.db,
            trip,
            amount_payable=settlement.amount_payable or ZERO,
            amount_recoverable=settlement.amount_recoverable or ZERO,
        )
        return self._commit(settlement, trip)

    def _load_editable(
        self, employee: Employee, travel_request_id: str
    ) -> tuple[TravelRequest, TravelSettlement]:
        """Requester's own approved trip + its settlement (created on first save), still editable."""
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        if trip.employee_id != employee.id:
            raise forbidden("Only the requester can edit the settlement")
        assert_settlement_open(trip)

        settlement = self._load_for_trip(trip.id)
        if settlement is None:
            settlement = TravelSettlement(travel_request_id=trip.id)
            self.db.add(settlement)
            self.db.flush()
        elif settlement.status not in _EDITABLE_STATUSES:
            raise AppException(
                status_code=422,
                sub_status_code="settlement_locked",
                message="This settlement can no longer be edited",
            )
        return trip, settlement

    def _load_for_finance(
        self, employee: Employee, travel_request_id: str
    ) -> tuple[TravelRequest, TravelSettlement]:
        """Trip + settlement waiting on Finance (queued for payment or recovery)."""
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        assert_not_own_trip(employee, trip)
        settlement = self._load_for_trip(trip.id)
        if settlement is None:
            raise not_found("settlement_not_found", "No settlement for this travel request")
        if settlement.status not in PAYMENT_DUE_STATUSES:
            raise AppException(
                status_code=422,
                sub_status_code="not_ready_for_payment",
                message="Settlement is not queued for payment or recovery",
            )
        return trip, settlement

    def _commit(self, settlement: TravelSettlement, trip: TravelRequest) -> SettlementRead:
        """Save settlement + trip (and any notifications) together, then reload for the response."""
        self.db.add(settlement)
        self.db.add(trip)
        self.db.commit()
        loaded = self._load_for_trip(trip.id)
        assert loaded is not None
        return self._to_read(loaded, trip.travel_request_id)

    def _submit(
        self,
        settlement: TravelSettlement,
        trip: TravelRequest,
        employee: Employee,
    ) -> None:
        # Clear the prior review on resubmit after return
        settlement.approvals.clear()
        self.db.flush()

        # Claims skip the business approval matrix: one review by the Finance Controller
        finance = self.employees.first_by_role(EmployeeRole.FINANCE, exclude_id=employee.id)
        if finance is None:
            raise AppException(
                status_code=422,
                sub_status_code="no_finance_controller",
                message="No Finance Controller is available to review this settlement",
            )
        settlement.approvals.append(
            TravelSettlementApproval(
                level=1,
                role_required=EmployeeRole.FINANCE,
                approver_id=finance.id,
                decision=ApprovalDecision.PENDING,
            )
        )

        settlement.status = SettlementStatus.FINANCE_REVIEW
        settlement.submitted_at = datetime.now(timezone.utc)
        trip.status = TravelRequestStatus.IN_SETTLEMENT

        # Tell the Finance Controller (committed by save())
        notify_current_approver(
            self.db,
            trip,
            settlement.approvals,
            requester=employee,
            subject="Settlement",
            amount=settlement.net_reimbursable,
        )

    @staticmethod
    def _assert_unique_proofs(proof_refs: list[str | None]) -> None:
        seen: set[str] = set()
        for ref in proof_refs:
            key = (ref or "").strip()
            if not key:
                continue
            if key in seen:
                label = key if is_desk_line(key) else f"Receipt #{key}"
                raise AppException(
                    status_code=422,
                    sub_status_code="duplicate_proof",
                    message=f"{label} is already used on another expense line",
                )
            seen.add(key)

    @staticmethod
    def _assert_within_trip(trip: TravelRequest, line: SettlementExpenseIn) -> None:
        """Expense dates must fall inside the trip (± one travel day)."""
        earliest = trip.start_date - timedelta(days=TRIP_DATE_BUFFER_DAYS)
        latest = trip.end_date + timedelta(days=TRIP_DATE_BUFFER_DAYS)
        for value in (line.check_in, line.check_out, line.expense_date):
            if value and not (earliest <= value <= latest):
                raise AppException(
                    status_code=422,
                    sub_status_code="expense_outside_trip",
                    message=(
                        f"Expense date {value:%d %b %Y} is outside the trip "
                        f"({trip.start_date:%d %b} – {trip.end_date:%d %b %Y})"
                    ),
                )

    def _assert_proof_for_trip(
        self, trip: TravelRequest, proof_ref: str | None
    ) -> None:
        """Receipt proofs must belong to this travel request only."""
        if proof_ref is None or not str(proof_ref).strip():
            return
        ref = str(proof_ref).strip()
        if is_desk_line(ref):
            return
        try:
            receipt_id = int(ref)
        except ValueError as exc:
            raise AppException(
                status_code=422,
                sub_status_code="invalid_proof_ref",
                message=(
                    "Proof must be a receipt uploaded for this travel request "
                    f"({trip.travel_request_id})"
                ),
            ) from exc
        stmt = select(TravelReceipt).where(
            TravelReceipt.id == receipt_id,
            TravelReceipt.travel_request_id == trip.id,
        )
        row = self.db.execute(stmt).scalar_one_or_none()
        if row is None:
            raise AppException(
                status_code=422,
                sub_status_code="proof_not_on_request",
                message=(
                    f"Receipt #{receipt_id} is not uploaded against "
                    f"{trip.travel_request_id}"
                ),
            )

    def _build_expense(self, line: SettlementExpenseIn) -> TravelExpense:
        if line.section == ExpenseSection.LODGING:
            expense_date = line.check_in
        else:
            expense_date = line.expense_date

        expense = TravelExpense(
            section=line.section,
            expense_date=expense_date,
            paid_by=line.paid_by,
            amount=line.amount,
            proof_ref=line.proof_ref,
            disallowed_amount=line.disallowed_amount,
            disallow_reason=line.disallow_reason,
        )
        if line.section == ExpenseSection.LODGING:
            expense.lodging = TravelExpenseLodging(
                check_in=line.check_in,  # type: ignore[arg-type]
                check_out=line.check_out,  # type: ignore[arg-type]
                hotel_name=line.hotel_name.strip(),  # type: ignore[union-attr]
                city=line.city.strip(),  # type: ignore[union-attr]
            )
        elif line.section == ExpenseSection.TRANSPORT:
            expense.transport = TravelExpenseTransport(
                expense_time=line.expense_time,
                from_location=line.from_location.strip(),  # type: ignore[union-attr]
                to_location=line.to_location.strip(),  # type: ignore[union-attr]
                mode=line.mode.strip(),  # type: ignore[union-attr]
            )
        else:
            expense.other = TravelExpenseOther(
                head=line.head.strip(),  # type: ignore[union-attr]
                description=(line.description.strip() if line.description else None),
            )
        return expense

    def _load_for_trip(self, trip_pk: int) -> TravelSettlement | None:
        stmt = (
            select(TravelSettlement)
            .where(TravelSettlement.travel_request_id == trip_pk)
            .options(
                selectinload(TravelSettlement.expenses).selectinload(
                    TravelExpense.lodging
                ),
                selectinload(TravelSettlement.expenses).selectinload(
                    TravelExpense.transport
                ),
                selectinload(TravelSettlement.expenses).selectinload(
                    TravelExpense.other
                ),
                selectinload(TravelSettlement.approvals),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def _to_read(
        self, settlement: TravelSettlement, business_id: str
    ) -> SettlementRead:
        expenses = []
        for exp in settlement.expenses:
            base = {
                "id": exp.id,
                "section": exp.section,
                "amount": exp.amount,
                "paid_by": exp.paid_by,
                "proof_ref": exp.proof_ref,
                "expense_date": exp.expense_date,
                "check_in": None,
                "check_out": None,
                "hotel_name": None,
                "city": None,
                "nights": None,
                "expense_time": None,
                "from_location": None,
                "to_location": None,
                "mode": None,
                "head": None,
                "description": None,
                "disallowed_amount": exp.disallowed_amount or ZERO,
                "disallow_reason": exp.disallow_reason,
            }
            if exp.lodging:
                nights = (exp.lodging.check_out - exp.lodging.check_in).days
                base.update(
                    {
                        "check_in": exp.lodging.check_in,
                        "check_out": exp.lodging.check_out,
                        "hotel_name": exp.lodging.hotel_name,
                        "city": exp.lodging.city,
                        "nights": max(nights, 0),
                    }
                )
            elif exp.transport:
                base.update(
                    {
                        "expense_time": exp.transport.expense_time,
                        "from_location": exp.transport.from_location,
                        "to_location": exp.transport.to_location,
                        "mode": exp.transport.mode,
                    }
                )
            elif exp.other:
                base.update(
                    {
                        "head": exp.other.head,
                        "description": exp.other.description,
                    }
                )
            expenses.append(base)
        return SettlementRead(
            id=settlement.id,
            travel_request_id=business_id,
            settlement_date=settlement.settlement_date,
            status=settlement.status,
            total_employee_paid=settlement.total_employee_paid,
            total_company_paid=settlement.total_company_paid,
            disallowed_total=settlement.disallowed_total,
            net_reimbursable=settlement.net_reimbursable,
            advance_applied=settlement.advance_applied,
            amount_payable=settlement.amount_payable,
            amount_recoverable=settlement.amount_recoverable,
            submitted_at=settlement.submitted_at,
            created_at=settlement.created_at,
            updated_at=settlement.updated_at,
            expenses=expenses,
            approvals=settlement.approvals,
        )
