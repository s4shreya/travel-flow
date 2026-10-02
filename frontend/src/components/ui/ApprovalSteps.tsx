import { firstPendingStep } from "@/lib/approvals";
import { formatDate } from "@/lib/dates";
import { formatDecision } from "@/lib/statusLabels";

interface ApprovalStep {
  id: number;
  level: number;
  role_required: string;
  approver_name?: string | null;
  decision: string;
  remarks?: string | null;
  decided_at?: string | null;
}

// Pill colour per decision
const DECISION_CLASS: Record<string, string> = {
  pending: "bg-sky-50 text-sky-800 ring-sky-600/20",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  returned: "bg-amber-50 text-amber-800 ring-amber-600/20",
  rejected: "bg-rose-50 text-rose-800 ring-rose-600/20",
  skipped: "bg-slate-100 text-slate-600 ring-slate-500/15",
};

// Level number marker, coloured by decision (upcoming levels stay white)
const MARKER_CLASS: Record<string, string> = {
  approved: "bg-emerald-600 text-white",
  returned: "bg-amber-500 text-white",
  rejected: "bg-rose-600 text-white",
  current: "bg-teal-600 text-white ring-4 ring-teal-600/15",
};

/** Sequential approval chain: who signs at each level and where it stands. */
export function ApprovalChain({
  title,
  approvals,
  youId,
}: {
  title: string;
  approvals: ApprovalStep[];
  /** Step id of the viewer's own level, tagged "You". */
  youId?: number;
}) {
  const current = firstPendingStep(approvals);
  const decided = approvals.filter((step) => step.decision !== "pending").length;
  // a single reviewer (e.g. Finance review of a claim) needs no level count
  const multiLevel = approvals.length > 1;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
      {/* chain name + how far it has got */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          {title} {multiLevel ? <span className="font-normal text-slate-500">· sequential</span> : null}
        </p>
        {multiLevel ? (
          <p className="text-xs text-slate-500">
            {current ? `Level ${current.level} of ${approvals.length}` : `${decided} of ${approvals.length} decided`}
          </p>
        ) : null}
      </div>

      <ol className="mt-2 flex flex-col">
        {approvals.map((step, index) => {
          const isCurrent = step.id === current?.id;
          const markerClass = MARKER_CLASS[isCurrent ? "current" : step.decision];
          return (
            <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
              {/* line down to the next level */}
              {index < approvals.length - 1 ? (
                <span aria-hidden className="absolute left-3 top-7 bottom-0 w-px bg-slate-200" />
              ) : null}
              <span
                aria-label={`Level ${step.level}`}
                className={`relative flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${markerClass ?? "border border-slate-300 bg-white text-slate-500"}`}
              >
                {step.level}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-slate-900">
                    {step.approver_name ?? "Unassigned"}
                    {step.id === youId ? <span className="ml-1 text-xs font-semibold text-teal-700">(You)</span> : null}
                  </span>
                  <span className="text-sm text-slate-500">· {step.role_required}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${DECISION_CLASS[step.decision] ?? DECISION_CLASS.skipped}`}
                  >
                    {isCurrent ? "Awaiting decision" : formatDecision(step.decision)}
                  </span>
                  {step.decided_at ? (
                    <span className="ml-auto text-xs text-slate-500">{formatDate(step.decided_at)}</span>
                  ) : null}
                </div>
                {step.remarks ? <p className="mt-0.5 text-xs text-slate-500">“{step.remarks}”</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

