import type { Settlement, SettlementStatus } from "@/api/settlements";
import { markSettlementPaid, returnSettlement } from "@/api/settlements";
import {
  declineAdvance,
  releaseAdvance,
  type TravelRequestListItem,
} from "@/api/travelRequests";
import { isRecovery } from "@/lib/settlement";
import type { TravelRequest } from "@/types/travelRequest";

export type FinanceTaskKind = "advance" | "payment" | "recovery";

export interface FinanceTask {
  kind: FinanceTaskKind;
  amount: number;
}

interface FinanceTaskCopy {
  label: string;
  action: string;
  confirmTitle: string;
  outcome: string;
  done: string;
  reject: string;
  rejectTitle: string;
  rejectBody: string;
  rejected: string;
}

const SEND_BACK = {
  reject: "Send back",
  rejectTitle: "Send settlement back?",
  rejectBody:
    "The claim returns to the employee to correct and resubmit, then goes through approval again.",
  rejected: "Settlement sent back",
};

// Labels and confirmation copy per task
export const FINANCE_TASK: Record<FinanceTaskKind, FinanceTaskCopy> = {
  advance: {
    label: "Advance release",
    action: "Release advance",
    confirmTitle: "Release travel advance?",
    outcome:
      "will be paid to the employee as a travel advance. This cannot be undone.",
    done: "Advance released",
    reject: "Decline advance",
    rejectTitle: "Decline this advance?",
    rejectBody:
      "No further advance is paid on this trip. The employee can still travel and claim expenses in the settlement.",
    rejected: "Advance declined",
  },
  payment: {
    label: "Settlement payment",
    action: "Release payment",
    confirmTitle: "Release settlement payment?",
    outcome: "will be paid to the employee and the request will be closed.",
    done: "Settlement paid",
    ...SEND_BACK,
  },
  recovery: {
    label: "Payroll recovery",
    action: "Record recovery",
    confirmTitle: "Record payroll recovery?",
    outcome:
      "of excess advance will be recovered from payroll and the request will be closed.",
    done: "Payroll recovery recorded",
    ...SEND_BACK,
  },
};

/** Settlement statuses waiting on Finance. */
const PAYMENT_STATUSES: SettlementStatus[] = [
  "queued_for_payment",
  "recoverable",
];

/** Advance still owed on an approved trip. */
export function advanceTask(
  trip: Pick<TravelRequest, "advance_requested" | "advance_disbursed">
): FinanceTask | null {
  const remaining =
    Number(trip.advance_requested) - Number(trip.advance_disbursed);
  return remaining > 0 ? { kind: "advance", amount: remaining } : null;
}

/** Payout to the employee, or payroll recovery of excess advance. */
export function paymentTask(outcome: {
  payable?: string | null;
  recoverable?: string | null;
}): FinanceTask {
  return isRecovery(outcome)
    ? { kind: "recovery", amount: Number(outcome.recoverable) }
    : { kind: "payment", amount: Number(outcome.payable || 0) };
}

/** What Finance must do on this trip now, if anything. */
export function financeTaskFor(
  trip: TravelRequest,
  settlement: Settlement | null
): FinanceTask | null {
  if (trip.status === "approved") return advanceTask(trip);
  if (settlement && PAYMENT_STATUSES.includes(settlement.status)) {
    return paymentTask({
      payable: settlement.amount_payable,
      recoverable: settlement.amount_recoverable,
    });
  }
  return null;
}

/** Unique payment reference per release (partial releases each get their own), e.g. ADV/TRQ-2026-0002/MG9K2X1Q. */
function advanceReference(travelRequestId: string): string {
  return `ADV/${travelRequestId}/${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Pay out: advance (full or partial) or settlement payout / recovery.
 * Returns the advance payment reference, or null for settlements.
 */
export async function releaseFunds(
  travelRequestId: string,
  task: FinanceTask,
  amount: number = task.amount
): Promise<string | null> {
  if (task.kind === "advance") {
    const reference = advanceReference(travelRequestId);
    await releaseAdvance(travelRequestId, amount.toFixed(2), reference);
    return reference;
  }
  await markSettlementPaid(travelRequestId);
  return null;
}

/** Decline the advance, or send the settlement back, with a reason. */
export async function rejectFinanceTask(
  travelRequestId: string,
  task: FinanceTask,
  remarks: string
): Promise<void> {
  if (task.kind === "advance") {
    await declineAdvance(travelRequestId, remarks);
    return;
  }
  await returnSettlement(travelRequestId, remarks);
}

export interface FinanceRow {
  row: TravelRequestListItem;
  task: FinanceTask;
}

/** Both Finance queues as one list, oldest first. */
export function financeRows(
  advances: TravelRequestListItem[],
  payments: TravelRequestListItem[]
): FinanceRow[] {
  const rows: FinanceRow[] = [
    ...advances.flatMap((row) => {
      const task = advanceTask(row);
      return task ? [{ row, task }] : [];
    }),
    ...payments.map((row) => ({
      row,
      task: paymentTask({
        payable: row.settlement_amount_payable,
        recoverable: row.settlement_amount_recoverable,
      }),
    })),
  ];
  return rows.sort((a, b) => a.row.created_at.localeCompare(b.row.created_at));
}
