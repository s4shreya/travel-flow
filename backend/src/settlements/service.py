from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.exceptions import AppException
from database.postgres.crud.employee import EmployeeCRUD
from database.postgres.models.employee import Employee
from database.postgres.models.enums import (
    ApprovalDecision,
    EmployeeRole,
    ExpenseSection,
    PaidBy,
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
from src.settlements.schemas import SettlementExpenseIn, SettlementRead, SettlementSave
from src.travel_requests.advance_side_effects import notify_settlement_funds_released
from src.travel_requests.approval_matrix import build_request_approval_plan
from src.travel_requests.service import TravelRequestService

DESK_PROOF_REFS = frozenset({"DESK-FLIGHT", "DESK-HOTEL"})


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
        # Travel-desk flight/hotel are always company-paid
        changed = False
        for exp in settlement.expenses:
            if exp.proof_ref in {"DESK-FLIGHT", "DESK-HOTEL"} and exp.paid_by != PaidBy.COMPANY:
                exp.paid_by = PaidBy.COMPANY
                changed = True
        if changed:
            self._recompute(settlement, trip)
            self.db.add(settlement)
            self.db.commit()
            settlement = self._load_for_trip(trip.id)
            assert settlement is not None
        return self._to_read(settlement, trip.travel_request_id)

    def save(
        self,
        employee: Employee,
        travel_request_id: str,
        payload: SettlementSave,
    ) -> SettlementRead:
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        if trip.employee_id != employee.id:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="Only the requester can edit the settlement",
            )
        if trip.status not in {
            TravelRequestStatus.APPROVED,
            TravelRequestStatus.IN_SETTLEMENT,
        }:
            raise AppException(
                status_code=422,
                sub_status_code="settlement_not_allowed",
                message="Settlement is only available after the travel request is approved",
            )

        settlement = self._load_for_trip(trip.id)
        if settlement is None:
            settlement = TravelSettlement(travel_request_id=trip.id)
            self.db.add(settlement)
            self.db.flush()
        elif settlement.status not in {
            SettlementStatus.DRAFT,
            SettlementStatus.RETURNED,
        }:
            raise AppException(
                status_code=422,
                sub_status_code="settlement_locked",
                message="This settlement can no longer be edited",
            )

        # Replace expense lines — proofs must belong to this travel request
        settlement.expenses.clear()
        self.db.flush()
        for line in payload.expenses:
            self._assert_proof_for_trip(trip, line.proof_ref)
            settlement.expenses.append(self._build_expense(line))

        self._recompute(settlement, trip, disallowed_override=payload.disallowed_total)
        settlement.settlement_date = payload.settlement_date or date.today()
        settlement.status = SettlementStatus.DRAFT

        if payload.submit:
            self._submit(settlement, trip, employee)

        self.db.add(settlement)
        self.db.add(trip)
        self.db.commit()
        loaded = self._load_for_trip(trip.id)
        assert loaded is not None
        return self._to_read(loaded, trip.travel_request_id)

    def append_expense(
        self,
        employee: Employee,
        travel_request_id: str,
        line: SettlementExpenseIn,
    ) -> SettlementRead:
        """Add one confirmed receipt line onto the settlement draft."""
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        if trip.employee_id != employee.id:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="Only the requester can edit the settlement",
            )
        if trip.status not in {
            TravelRequestStatus.APPROVED,
            TravelRequestStatus.IN_SETTLEMENT,
        }:
            raise AppException(
                status_code=422,
                sub_status_code="settlement_not_allowed",
                message="Settlement is only available after the travel request is approved",
            )

        settlement = self._load_for_trip(trip.id)
        if settlement is None:
            settlement = TravelSettlement(travel_request_id=trip.id)
            self.db.add(settlement)
            self.db.flush()
        elif settlement.status not in {
            SettlementStatus.DRAFT,
            SettlementStatus.RETURNED,
        }:
            raise AppException(
                status_code=422,
                sub_status_code="settlement_locked",
                message="This settlement can no longer be edited",
            )

        self._assert_proof_for_trip(trip, line.proof_ref)
        settlement.expenses.append(self._build_expense(line))
        self._recompute(
            settlement,
            trip,
            disallowed_override=settlement.disallowed_total or Decimal("0"),
        )
        settlement.settlement_date = settlement.settlement_date or date.today()
        settlement.status = SettlementStatus.DRAFT
        self.db.add(settlement)
        self.db.commit()
        loaded = self._load_for_trip(trip.id)
        assert loaded is not None
        return self._to_read(loaded, trip.travel_request_id)

    def mark_paid(
        self, employee: Employee, travel_request_id: str
    ) -> SettlementRead:
        # Finance marks payment / recovery complete
        if employee.role != EmployeeRole.FINANCE:
            raise AppException(
                status_code=403,
                sub_status_code="forbidden",
                message="Only Finance can mark payment status",
            )
        trip = self.trips.get_for_viewer(employee, travel_request_id)
        settlement = self._load_for_trip(trip.id)
        if settlement is None:
            raise AppException(
                status_code=404,
                sub_status_code="settlement_not_found",
                message="No settlement for this travel request",
            )
        if settlement.status not in {
            SettlementStatus.QUEUED_FOR_PAYMENT,
            SettlementStatus.RECOVERABLE,
        }:
            raise AppException(
                status_code=422,
                sub_status_code="not_ready_for_payment",
                message="Settlement is not queued for payment or recovery",
            )
        was_recovery = settlement.status == SettlementStatus.RECOVERABLE
        payable = settlement.amount_payable or Decimal("0")
        recoverable = settlement.amount_recoverable or Decimal("0")
        settlement.status = SettlementStatus.PAID
        trip.status = TravelRequestStatus.CLOSED
        # Notify the requester (not Finance)
        notify_settlement_funds_released(
            self.db,
            trip,
            amount_payable=payable,
            amount_recoverable=recoverable,
            was_recovery=was_recovery,
        )
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
        # Clear prior settlement approvals on resubmit after return
        settlement.approvals.clear()
        self.db.flush()

        claimed = settlement.net_reimbursable
        plan = build_request_approval_plan(
            self.employees,
            employee,
            claimed,
            trip.travel_category,
        )
        for level, role, approver, skipped in plan:
            settlement.approvals.append(
                TravelSettlementApproval(
                    level=level,
                    role_required=role,
                    approver_id=None if skipped else (approver.id if approver else None),
                    decision=(
                        ApprovalDecision.SKIPPED
                        if skipped
                        else ApprovalDecision.PENDING
                    ),
                )
            )

        # Finance verification after business approvals (policy §2.1)
        finance = self.employees.first_by_role(EmployeeRole.FINANCE)
        next_level = (max((a.level for a in settlement.approvals), default=0)) + 1
        settlement.approvals.append(
            TravelSettlementApproval(
                level=next_level,
                role_required=EmployeeRole.FINANCE,
                approver_id=finance.id if finance else None,
                decision=ApprovalDecision.PENDING,
            )
        )

        pending = [
            a for a in settlement.approvals if a.decision == ApprovalDecision.PENDING
        ]
        if not pending:
            raise AppException(
                status_code=422,
                sub_status_code="no_pending_approver",
                message="Could not build a settlement approval chain",
            )

        settlement.status = SettlementStatus.IN_APPROVAL
        settlement.submitted_at = datetime.now(timezone.utc)
        trip.status = TravelRequestStatus.IN_SETTLEMENT

    def _assert_proof_for_trip(
        self, trip: TravelRequest, proof_ref: str | None
    ) -> None:
        """Receipt proofs must belong to this travel request only."""
        if proof_ref is None or not str(proof_ref).strip():
            return
        ref = str(proof_ref).strip()
        if ref in DESK_PROOF_REFS:
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

    def _recompute(
        self,
        settlement: TravelSettlement,
        trip: TravelRequest,
        *,
        disallowed_override: Decimal | None = None,
    ) -> None:
        employee_paid = Decimal("0")
        company_paid = Decimal("0")
        for line in settlement.expenses:
            if line.paid_by == PaidBy.EMPLOYEE:
                employee_paid += line.amount
            else:
                company_paid += line.amount

        disallowed = (
            disallowed_override
            if disallowed_override is not None
            else settlement.disallowed_total
        )
        if disallowed < 0:
            disallowed = Decimal("0")

        net = employee_paid - disallowed
        if net < 0:
            net = Decimal("0")
        # Full advance released — excess over net is recoverable from payroll
        advance = trip.advance_disbursed or Decimal("0")
        balance = net - advance

        settlement.total_employee_paid = employee_paid
        settlement.total_company_paid = company_paid
        settlement.disallowed_total = disallowed
        settlement.net_reimbursable = net
        settlement.advance_applied = advance
        settlement.amount_payable = balance if balance > 0 else Decimal("0")
        settlement.amount_recoverable = (
            abs(balance) if balance < 0 else Decimal("0")
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
            disallowed_amount=Decimal("0"),
            disallow_reason=None,
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
