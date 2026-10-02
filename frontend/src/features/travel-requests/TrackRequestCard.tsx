import { CheckCircle2, ChevronRight, XCircle, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { TravelRequestListItem } from "@/api/travelRequests";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TripProgress } from "@/components/ui/TripProgress";
import { formatTripDates } from "@/lib/dates";
import { formatAmountValue } from "@/lib/money";
import { paths } from "@/lib/routes";
import { outcomeSummary } from "@/lib/settlement";
import { formatRequestStatus } from "@/lib/statusLabels";
import { tripOutcome, tripSteps, type TripOutcome } from "@/lib/tripProgress";
import { NOT_SET } from "@/lib/text";

interface OutcomeStyle {
  card: string;
  icon?: LucideIcon;
  iconClass?: string;
  note?: string;
}

// Closed trips: coloured accent + icon so they read as finished at a glance
const OUTCOME_STYLE: Record<TripOutcome, OutcomeStyle> = {
  active: {
    card: "border-slate-200 bg-white hover:border-teal-700/40",
  },
  completed: {
    card: "border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50/40 hover:border-emerald-300",
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    note: "bg-white/80 text-emerald-800 ring-emerald-600/15",
  },
  rejected: {
    card: "border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/40 hover:border-rose-300",
    icon: XCircle,
    iconClass: "text-rose-600",
    note: "bg-white/80 text-rose-800 ring-rose-600/15",
  },
};

/** One-line ending of a closed trip, e.g. "Excess advance recovered via payroll (₹10000.00)". */
function closedNote(row: TravelRequestListItem, outcome: TripOutcome): string {
  if (outcome === "rejected") {
    return tripSteps(row).find((step) => step.state === "rejected")?.caption ?? "Rejected";
  }
  const text = (row.progress_label ?? "").replace(/^Closed\s*—\s*/, "");
  return text ? text[0].toUpperCase() + text.slice(1) : "Paid & closed";
}

export function TrackRequestCard({ row }: { row: TravelRequestListItem }) {
  const outcome = tripOutcome(row);
  const style = OUTCOME_STYLE[outcome];
  const Icon = style.icon;

  return (
    <Link
      to={paths.trip(row.travel_request_id)}
      className={`group block rounded-xl border px-4 py-4 shadow-sm transition ${style.card}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {Icon ? (
            <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${style.iconClass}`} />
          ) : null}
          <div>
            <p className="font-semibold text-slate-900">{row.travel_request_id}</p>
            <p className="mt-1 text-sm text-slate-600">
              {row.destination ?? NOT_SET} · {formatTripDates(row.start_date, row.end_date)}
            </p>
          </div>
        </div>
        {outcome === "active" ? (
          <span className="max-w-[16rem] rounded-full bg-teal-50 px-2.5 py-1 text-right text-xs font-medium text-teal-900">
            {row.progress_label || formatRequestStatus(row.status)}
          </span>
        ) : (
          <StatusBadge status={row.status} settlementStatus={row.settlement_status} />
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Estimate ₹{formatAmountValue(row.estimated_cost)} · Advance ₹
        {formatAmountValue(row.advance_disbursed)}/
        {formatAmountValue(row.advance_requested)}
        {outcomeSummary({
          payable: row.settlement_amount_payable,
          recoverable: row.settlement_amount_recoverable,
        })}
      </p>

      {outcome === "active" ? (
        // Step-by-step progress of the trip (includes who it's pending with)
        <TripProgress
          variant="compact"
          status={row.status}
          advance_requested={row.advance_requested}
          advance_disbursed={row.advance_disbursed}
          settlement_status={row.settlement_status}
          pending_with={row.pending_with}
        />
      ) : (
        // Finished trips collapse to how they ended
        <div
          className={`mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${style.note}`}
        >
          <span className="font-medium">{closedNote(row, outcome)}</span>
          <span className="inline-flex items-center gap-0.5 text-xs text-slate-500 group-hover:text-slate-800">
            View details
            <ChevronRight aria-hidden className="size-3.5" />
          </span>
        </div>
      )}
    </Link>
  );
}
