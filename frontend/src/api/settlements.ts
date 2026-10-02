import { apiFetch } from "@/api/client";

export type SettlementStatus =
  | "draft"
  | "returned"
  | "finance_review"
  | "queued_for_payment"
  | "paid"
  | "recoverable";

export interface SettlementExpense {
  id?: number;
  section: "lodging" | "transport" | "other";
  amount: string;
  paid_by: "Employee" | "Company";
  proof_ref: string | null;
  expense_date?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  hotel_name?: string | null;
  city?: string | null;
  nights?: number | null;
  expense_time?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  mode?: string | null;
  head?: string | null;
  description?: string | null;
  /** Policy deduction on this line; settlement disallowed total is their sum. */
  disallowed_amount?: string;
  disallow_reason?: string | null;
}

export interface SettlementApproval {
  id: number;
  level: number;
  role_required: string;
  approver_id: number | null;
  approver_name: string | null;
  decision: string;
  remarks: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Settlement {
  id: number;
  travel_request_id: string;
  settlement_date: string | null;
  status: SettlementStatus;
  total_employee_paid: string;
  total_company_paid: string;
  disallowed_total: string;
  net_reimbursable: string;
  advance_applied: string;
  amount_payable: string;
  amount_recoverable: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  expenses: SettlementExpense[];
  approvals: SettlementApproval[];
}

export interface SettlementSavePayload {
  settlement_date?: string | null;
  expenses: SettlementExpense[];
  submit: boolean;
}

const settlementPath = (travelRequestId: string) =>
  `/api/travel-requests/${travelRequestId}/settlement`;

export function getSettlement(travelRequestId: string): Promise<Settlement | null> {
  return apiFetch<Settlement | null>(settlementPath(travelRequestId));
}

export function saveSettlement(
  travelRequestId: string,
  payload: SettlementSavePayload,
): Promise<Settlement> {
  return apiFetch<Settlement>(settlementPath(travelRequestId), {
    method: "PUT",
    body: payload,
  });
}

export function markSettlementPaid(travelRequestId: string): Promise<Settlement> {
  return apiFetch<Settlement>(`${settlementPath(travelRequestId)}/mark-paid`, {
    method: "POST",
  });
}

/** Finance sends an approved settlement back to the employee (reason required). */
export function returnSettlement(
  travelRequestId: string,
  remarks: string,
): Promise<Settlement> {
  return apiFetch<Settlement>(`${settlementPath(travelRequestId)}/return`, {
    method: "POST",
    body: { remarks },
  });
}
