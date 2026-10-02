import type { TravelRequestListItem } from "@/api/travelRequests";
import { EXPENSE_SECTION_OPTIONS } from "@/config/options";
import { moneyValue } from "@/lib/money";
import { tripOutcome } from "@/lib/tripProgress";

export type StageKey =
  | "draft"
  | "approval"
  | "approved"
  | "settlement"
  | "completed"
  | "rejected";

export interface StageCount {
  key: StageKey;
  label: string;
  count: number;
}

export interface SectionSpend {
  section: string;
  /** Employee-paid, minus what policy disallowed. */
  reimbursable: number;
  disallowed: number;
  companyPaid: number;
}

export interface TripMoney {
  trip: string;
  estimate: number;
  advance: number;
  actual: number | null;
}

// Pipeline stages in flow order
const STAGES: [StageKey, string][] = [
  ["draft", "Draft"],
  ["approval", "Awaiting approval"],
  ["approved", "Approved"],
  ["settlement", "In settlement"],
  ["completed", "Completed"],
  ["rejected", "Rejected"],
];

const STATUS_STAGE: Record<string, StageKey> = {
  draft: "draft",
  pending_approval: "approval",
  approved: "approved",
  in_settlement: "settlement",
};

function stageOf(trip: TravelRequestListItem): StageKey {
  const outcome = tripOutcome(trip);
  if (outcome !== "active") return outcome;
  return STATUS_STAGE[trip.status] ?? "draft";
}

/** How many trips sit at each stage of request → approval → settlement → payout. */
export function tripPipeline(trips: TravelRequestListItem[]): StageCount[] {
  const counts = new Map<StageKey, number>();
  for (const trip of trips) {
    const stage = stageOf(trip);
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  return STAGES.map(([key, label]) => ({
    key,
    label,
    count: counts.get(key) ?? 0,
  })).filter((stage) => stage.count > 0);
}

/** Settled spend per expense section, split into reimbursable / disallowed / company-paid. */
export function spendBySection(trips: TravelRequestListItem[]): SectionSpend[] {
  const rows = EXPENSE_SECTION_OPTIONS.map(({ value, label }) => ({
    key: value,
    section: label,
    reimbursable: 0,
    disallowed: 0,
    companyPaid: 0,
  }));
  for (const trip of trips) {
    for (const split of trip.settlement_expense_split ?? []) {
      const row = rows.find((r) => r.key === split.section);
      if (!row) continue;
      const disallowed = moneyValue(split.disallowed);
      row.reimbursable += moneyValue(split.employee_paid) - disallowed;
      row.disallowed += disallowed;
      row.companyPaid += moneyValue(split.company_paid);
    }
  }
  return rows.filter((r) => r.reimbursable + r.disallowed + r.companyPaid > 0);
}

/** Estimate vs advance vs actual for the most recent trips (oldest first). */
export function advanceVsActual(
  trips: TravelRequestListItem[],
  limit = 6
): TripMoney[] {
  return [...trips]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-limit)
    .map((trip) => ({
      trip: trip.travel_request_id.replace(/^TRQ-/, ""),
      estimate: moneyValue(trip.estimated_cost),
      advance: moneyValue(trip.advance_disbursed),
      actual:
        trip.settlement_actual_spend != null
          ? moneyValue(trip.settlement_actual_spend)
          : null,
    }));
}
