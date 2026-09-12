import { apiFetch } from "@/api/client";

export type SettlementStatus =
  | "draft"
  | "submitted"
  | "returned"
  | "in_approval"
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
}

export interface SettlementApproval {
  id: number;
  level: number;
  role_required: string;
  approver_id: number | null;
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
  disallowed_total: string;
  submit: boolean;
}

export function getSettlement(
  employeeCode: string,
  travelRequestId: string,
): Promise<Settlement | null> {
  return apiFetch<Settlement | null>(
    `/api/travel-requests/${travelRequestId}/settlement`,
    { method: "GET", employeeCode },
  );
}

export function saveSettlement(
  employeeCode: string,
  travelRequestId: string,
  payload: SettlementSavePayload,
): Promise<Settlement> {
  return apiFetch<Settlement>(
    `/api/travel-requests/${travelRequestId}/settlement`,
    { method: "PUT", employeeCode, body: payload },
  );
}

export function markSettlementPaid(
  employeeCode: string,
  travelRequestId: string,
): Promise<Settlement> {
  return apiFetch<Settlement>(
    `/api/travel-requests/${travelRequestId}/settlement/mark-paid`,
    { method: "POST", employeeCode },
  );
}
