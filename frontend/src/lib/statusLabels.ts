import type {
  ApprovalDecision,
  TravelRequestStatus,
} from "@/types/travelRequest";

const REQUEST_STATUS_LABELS: Record<TravelRequestStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  in_settlement: "In Settlement",
  closed: "Closed",
};

const DECISION_LABELS: Record<ApprovalDecision, string> = {
  pending: "Pending",
  approved: "Approved",
  returned: "Returned",
  rejected: "Rejected",
  skipped: "Skipped",
};

/** Human-readable travel request status for UI. */
export function formatRequestStatus(status: string): string {
  if (status in REQUEST_STATUS_LABELS) {
    return REQUEST_STATUS_LABELS[status as TravelRequestStatus];
  }
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Human-readable approval decision for UI. */
export function formatDecision(decision: string): string {
  if (decision in DECISION_LABELS) {
    return DECISION_LABELS[decision as ApprovalDecision];
  }
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}
