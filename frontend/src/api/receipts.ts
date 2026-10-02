import { apiFetch, apiFetchBlob } from "@/api/client";

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
  disallowed_amount?: string;
  disallow_reason?: string | null;
}

export type PolicyLevel = "info" | "warning" | "violation";

export interface PolicyFinding {
  level: PolicyLevel;
  code: string;
  message: string;
}

/** matched: a travel bill · needs_review: a bill, but maybe not this trip's · not_receipt: not a bill. */
export type EvidenceStatus = "matched" | "needs_review" | "not_receipt";

/** OCR result: suggested expense line + policy findings, for the employee to review. */
export interface ReceiptExtraction {
  receipt_id: number;
  confidence: "high" | "medium" | "low";
  evidence: EvidenceStatus;
  evidence_note: string | null;
  merchant: string | null;
  bill_number: string | null;
  suggestion: Omit<ReceiptExpensePayload, "amount" | "disallowed_amount"> & {
    amount: string | null;
    disallowed_amount: string;
  };
  findings: PolicyFinding[];
}

const receiptsPath = (travelRequestId: string) =>
  `/api/travel-requests/${travelRequestId}/receipts`;

export function listReceipts(travelRequestId: string): Promise<Receipt[]> {
  return apiFetch<Receipt[]>(receiptsPath(travelRequestId));
}

export function uploadReceipt(travelRequestId: string, file: File): Promise<Receipt> {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<Receipt>(receiptsPath(travelRequestId), { method: "POST", body });
}

/** Delete a bill that is not on any expense line (row + file). */
export function deleteReceipt(
  travelRequestId: string,
  receiptId: number | string,
): Promise<void> {
  return apiFetch<void>(`${receiptsPath(travelRequestId)}/${receiptId}`, {
    method: "DELETE",
  });
}

export function extractReceipt(
  travelRequestId: string,
  receiptId: number,
  signal?: AbortSignal,
): Promise<ReceiptExtraction> {
  return apiFetch<ReceiptExtraction>(
    `${receiptsPath(travelRequestId)}/${receiptId}/extract`,
    { method: "POST", signal },
  );
}

/** The uploaded file itself (image or PDF) for in-app viewing. */
export function getReceiptFile(travelRequestId: string, receiptId: number | string): Promise<Blob> {
  return apiFetchBlob(`${receiptsPath(travelRequestId)}/${receiptId}/file`);
}