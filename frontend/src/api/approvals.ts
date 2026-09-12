import { apiFetch } from "@/api/client";

export interface ApprovalInboxItem {
  kind: "travel_request" | "settlement";
  approval_id: number;
  travel_request_id: string;
  destination: string;
  level: number;
  role_required: string;
  amount: string;
  requester_employee_id: number;
  created_at: string;
}

export function fetchApprovalInbox(
  employeeCode: string,
): Promise<ApprovalInboxItem[]> {
  return apiFetch<ApprovalInboxItem[]>("/api/approvals/inbox", {
    method: "GET",
    employeeCode,
  });
}

export function decideApproval(
  employeeCode: string,
  approvalId: number,
  decision: "approved" | "returned" | "rejected",
  remarks?: string,
  kind: "travel_request" | "settlement" = "travel_request",
): Promise<unknown> {
  return apiFetch(`/api/approvals/${approvalId}/decide`, {
    method: "POST",
    employeeCode,
    body: { decision, remarks: remarks ?? null, kind },
  });
}
