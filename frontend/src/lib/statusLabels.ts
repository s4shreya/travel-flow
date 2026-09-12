/** Human-readable status labels for request / settlement / decisions. */

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

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Settlement draft",
  submitted: "Settlement submitted",
  returned: "Settlement returned",
  in_approval: "Settlement pending approval",
  finance_review: "Settlement with Finance",
  queued_for_payment: "Awaiting fund release",
  paid: "Funds released / recovered",
  recoverable: "Excess advance — payroll recovery",
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
  return titleCase(status);
}

export function formatSettlementStatus(status: string): string {
  if (status in SETTLEMENT_STATUS_LABELS) {
    return SETTLEMENT_STATUS_LABELS[status];
  }
  return titleCase(status);
}

/** Human-readable approval decision for UI. */
export function formatDecision(decision: string): string {
  if (decision in DECISION_LABELS) {
    return DECISION_LABELS[decision as ApprovalDecision];
  }
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}

function titleCase(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
