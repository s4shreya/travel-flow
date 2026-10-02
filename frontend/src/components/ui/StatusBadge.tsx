import { formatRequestStatus, formatSettlementStatus } from "@/lib/statusLabels";
import { tripOutcome, type TripOutcome } from "@/lib/tripProgress";

type Tone = "slate" | "amber" | "sky" | "violet" | "emerald" | "rose" | "orange";

const TONE_CLASS: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-500/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  sky: "bg-sky-50 text-sky-800 ring-sky-600/20",
  violet: "bg-violet-50 text-violet-800 ring-violet-600/20",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  rose: "bg-rose-50 text-rose-800 ring-rose-600/20",
  orange: "bg-orange-50 text-orange-800 ring-orange-600/20",
};

const DOT_CLASS: Record<Tone, string> = {
  slate: "bg-slate-400",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
};

const SETTLEMENT_TONE: Record<string, Tone> = {
  draft: "violet",
  submitted: "violet",
  returned: "rose",
  finance_review: "amber",
  queued_for_payment: "sky",
  paid: "emerald",
  recoverable: "orange",
};

const REQUEST_TONE: Record<string, Tone> = {
  draft: "slate",
  pending_approval: "amber",
  approved: "sky",
  in_settlement: "violet",
};

interface StatusBadgeProps {
  status: string;
  /** While in settlement, the settlement status is more informative. */
  settlementStatus?: string | null;
  /** Viewer-specific wording, e.g. "Awaiting your approval" (colour stays the same). */
  label?: string;
}

/** Closed trips show how they ended instead of a generic "Closed". */
const OUTCOME_BADGE: Record<Exclude<TripOutcome, "active">, { tone: Tone; label: string }> = {
  completed: { tone: "emerald", label: "Completed" },
  rejected: { tone: "rose", label: "Rejected" },
};

/** Coloured pill for a travel request's lifecycle stage. */
export function StatusBadge({ status, settlementStatus, label: labelOverride }: StatusBadgeProps) {
  const outcome = tripOutcome({ status, settlement_status: settlementStatus });
  const useSettlement = status === "in_settlement" && settlementStatus;
  const tone =
    outcome !== "active"
      ? OUTCOME_BADGE[outcome].tone
      : useSettlement
        ? (SETTLEMENT_TONE[settlementStatus] ?? "violet")
        : (REQUEST_TONE[status] ?? "slate");
  const label =
    outcome !== "active"
      ? OUTCOME_BADGE[outcome].label
      : useSettlement
        ? formatSettlementStatus(settlementStatus)
        : formatRequestStatus(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />
      {labelOverride ?? label}
    </span>
  );
}
