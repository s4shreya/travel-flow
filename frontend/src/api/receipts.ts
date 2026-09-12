import { apiFetch } from "@/api/client";
import type { Settlement } from "@/api/settlements";

export interface Receipt {
  id: number;
  travel_request_id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ReceiptExpensePayload {
  section: "lodging" | "transport" | "other";
  paid_by: "Employee" | "Company";
  amount: string;
  check_in?: string | null;
  check_out?: string | null;
  hotel_name?: string | null;
  city?: string | null;
  expense_date?: string | null;
  expense_time?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  mode?: string | null;
  head?: string | null;
  description?: string | null;
}

export function listReceipts(
  employeeCode: string,
  travelRequestId: string,
): Promise<Receipt[]> {
  return apiFetch<Receipt[]>(
    `/api/travel-requests/${travelRequestId}/receipts`,
    { method: "GET", employeeCode },
  );
}

export function uploadReceipt(
  employeeCode: string,
  travelRequestId: string,
  file: File,
): Promise<Receipt> {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<Receipt>(
    `/api/travel-requests/${travelRequestId}/receipts`,
    { method: "POST", employeeCode, body },
  );
}

export function confirmReceipt(
  employeeCode: string,
  travelRequestId: string,
  receiptId: number,
  payload: ReceiptExpensePayload,
): Promise<Settlement> {
  return apiFetch<Settlement>(
    `/api/travel-requests/${travelRequestId}/receipts/${receiptId}/confirm`,
    { method: "POST", employeeCode, body: payload },
  );
}
