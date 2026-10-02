/** Where a trip is in the request → approval → advance → settlement → payment flow. */

export type StepState = "done" | "current" | "upcoming" | "rejected";

export type StepKey = "request" | "approval" | "advance" | "claim" | "review" | "payment";

export interface TripStep {
  key: StepKey;
  label: string;
  /** One-word label for tight spaces, e.g. "Advance". */
  shortLabel: string;
  /** What happens at this step, e.g. "Goes for a decision". */
  description: string;
  state: StepState;
  /** Live status under the current step, e.g. "With Finance". */
  caption?: string;
}

export interface TripProgressInput {
  status: string;
  advance_requested: string | number;
  advance_disbursed: string | number;
  settlement_status?: string | null;
  /** Who the current approval sits with (role / name). */
  pending_with?: string | null;
}

export type TripOutcome = "active" | "completed" | "rejected";

/** Closed trips either completed (settlement paid) or were rejected. */
export function tripOutcome({
  status,
  settlement_status,
}: Pick<TripProgressInput, "status" | "settlement_status">): TripOutcome {
  if (status !== "closed") return "active";
  return settlement_status === "paid" ? "completed" : "rejected";
}

export function advancePending({
  advance_requested,
  advance_disbursed,
}: Pick<TripProgressInput, "advance_requested" | "advance_disbursed">): boolean {
  return (Number(advance_requested) || 0) > 0 && (Number(advance_disbursed) || 0) <= 0;
}

// [key, label, short label, description]
const STEP_LABELS: [StepKey, string, string, string][] = [
  ["request", "Travel request", "Request", "You fill trip details"],
  ["approval", "Trip approval", "Approval", "Goes for a decision"],
  ["advance", "Advance disbursement", "Advance", "Advance reaches you"],
  ["claim", "Trip settlement", "Settlement", "You file bills & actuals"],
  ["review", "Finance review", "Review", "Finance Controller checks"],
  ["payment", "Payout", "Payout", "Paid & closed"],
];

// index of each step in STEP_LABELS
const REQUEST = 0;
const APPROVAL = 1;
const ADVANCE = 2;
const CLAIM = 3;
const REVIEW = 4;
const PAYMENT = 5;

/** Current step index, plus whether the trip ended there (rejected) and its caption. */
function locate(input: TripProgressInput): {
  index: number;
  rejected?: boolean;
  caption?: string;
} {
  const settlement = input.settlement_status ?? null;
  const withWhom = input.pending_with ? `With ${input.pending_with}` : undefined;

  switch (input.status) {
    case "draft":
      return { index: REQUEST, caption: "Not submitted" };
    case "pending_approval":
      return { index: APPROVAL, caption: withWhom ?? "Awaiting approval" };
    case "approved":
      if (advancePending(input)) {
        return { index: ADVANCE, caption: "With Finance" };
      }
      return {
        index: CLAIM,
        caption: settlement === "returned" ? "Returned — revise" : "Add your expenses",
      };
    case "in_settlement":
      // submitted claims sit with the Finance Controller
      if (settlement === "finance_review") {
        return { index: REVIEW, caption: withWhom ?? "With Finance" };
      }
      if (settlement === "queued_for_payment") {
        return { index: PAYMENT, caption: "Funds being released" };
      }
      if (settlement === "recoverable") {
        return { index: PAYMENT, caption: "Payroll recovery" };
      }
      return { index: CLAIM, caption: "Add your expenses" };
    case "closed":
      if (tripOutcome(input) === "completed") return { index: PAYMENT + 1 };
      // A closed trip without a paid settlement was rejected
      if (settlement) return { index: REVIEW, rejected: true, caption: "Claim rejected" };
      return { index: APPROVAL, rejected: true, caption: "Request rejected" };
    default:
      return { index: REQUEST };
  }
}

export function tripSteps(input: TripProgressInput): TripStep[] {
  const { index, rejected, caption } = locate(input);
  const noAdvance = (Number(input.advance_requested) || 0) <= 0;

  return STEP_LABELS.map(([key, label, shortLabel, description], i) => {
    let state: StepState = "upcoming";
    if (i < index) state = "done";
    else if (i === index) state = rejected ? "rejected" : "current";

    let stepCaption = i === index ? caption : undefined;
    if (i === ADVANCE && noAdvance && state === "done") stepCaption = "Not requested";
    return { key, label, shortLabel, description, state, caption: stepCaption };
  });
}

/** Steps for a request that hasn't been created yet ("What happens after you submit"). */
export function previewSteps(): TripStep[] {
  return STEP_LABELS.map(([key, label, shortLabel, description], i) => ({
    key,
    label,
    shortLabel,
    description,
    state: i === REQUEST ? "current" : "upcoming",
    caption: i === REQUEST ? "You are here" : undefined,
  }));
}

/** 0–100: share of steps completed (current step counts as half). */
export function tripPercent(steps: TripStep[]): number {
  const done = steps.filter((step) => step.state === "done").length;
  const current = steps.some((step) => step.state === "current") ? 0.5 : 0;
  return Math.round(((done + current) / steps.length) * 100);
}
