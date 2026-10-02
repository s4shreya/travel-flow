import { apiFetch } from "@/api/client";
import type { ApprovalStep } from "@/types/travelRequest";

export type ApprovalKind = "travel_request" | "settlement";
export type ApprovalDecisionInput = "approved" | "returned" | "rejected";

export interface ApprovalInboxItem {
  kind: ApprovalKind;
  approval_id: number;
  travel_request_id: string;
  destination: string;
  level: number;
  role_required: string;
  amount: string;
  requester_employee_id: number;
  requester_name: string;
  created_at: string;
  /** Whole chain for this request / settlement. */
  approvals: ApprovalStep[];
}

export function fetchApprovalInbox(): Promise<ApprovalInboxItem[]> {
  return apiFetch<ApprovalInboxItem[]>("/api/approvals/inbox");
}

export function decideApproval(
  approvalId: number,
  decision: ApprovalDecisionInput,
  remarks?: string,
  kind: ApprovalKind = "travel_request",
): Promise<ApprovalStep> {
  return apiFetch<ApprovalStep>(`/api/approvals/${approvalId}/decide`, {
    method: "POST",
    body: { decision, remarks: remarks ?? null, kind },
  });
}
