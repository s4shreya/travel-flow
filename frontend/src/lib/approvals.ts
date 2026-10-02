/** Helpers for sequential approval chains (request and settlement). */

import type { ApprovalDecisionInput, ApprovalKind } from "@/api/approvals";

interface ApprovalLike {
  decision: string;
  role_required: string;
  approver_id: number | null;
}

/** First step still waiting for a decision. */
export function firstPendingStep<T extends Pick<ApprovalLike, "decision">>(
  approvals: T[],
): T | null {
  return approvals.find((step) => step.decision === "pending") ?? null;
}

const DECISION_OUTCOME: Record<ApprovalDecisionInput, string> = {
  approved: "approved and will move to the next step",
  returned: "returned to the employee for correction",
  rejected: "rejected",
};

/** Success title / body after an approver decides on a request or settlement. */
export function decisionCopy(
  kind: ApprovalKind,
  travelRequestId: string,
  decision: ApprovalDecisionInput,
): { title: string; body: string } {
  const isSettlement = kind === "settlement";
  const subject = isSettlement
    ? `The settlement for ${travelRequestId}`
    : travelRequestId;
  return {
    title: `${isSettlement ? "Settlement" : "Request"} ${decision === "returned" ? "sent back" : decision}`,
    body: `${subject} has been ${DECISION_OUTCOME[decision]}.`,
  };
}

/** First pending step assigned to this employee (sequential chain). */
export function currentPendingForEmployee<
  T extends Pick<ApprovalLike, "decision" | "approver_id">,
>(approvals: T[], employeeId: number): T | null {
  const pending = firstPendingStep(approvals);
  if (!pending || pending.approver_id !== employeeId) return null;
  return pending;
}
