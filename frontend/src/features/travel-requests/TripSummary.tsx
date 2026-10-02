import { ArrowRight, Eye } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type { Settlement } from "@/api/settlements";
import { ApprovalChain } from "@/components/ui/ApprovalSteps";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TripProgress } from "@/components/ui/TripProgress";
import { claimTitle } from "@/features/claims/claimTypes";
import { tripKindOf } from "@/features/travel-requests/formModel";
import { ReceiptViewer } from "@/features/travel-requests/ReceiptViewer";
import {
  expenseSummary,
  isDeskLine,
  proofLabel,
  receiptIdOf,
} from "@/features/travel-requests/settlementFormModel";
import { firstPendingStep } from "@/lib/approvals";
import { formatTripDates } from "@/lib/dates";
import { formatAmountValue, formatRupees } from "@/lib/money";
import { NOT_SET } from "@/lib/text";
import type { TravelRequest } from "@/types/travelRequest";

/** Step the active chain (trip, then settlement) is waiting on now. */
function waitingOnStep(request: TravelRequest, settlement?: Settlement | null) {
  const activeChain = request.status === "pending_approval" ? request.approvals : settlement?.approvals ?? [];
  return firstPendingStep(activeChain);
}

/** Review header: id, status, one-line summary, then the page's action buttons. */
export function ReviewHeader({
  request,
  settlement,
  amount,
  badgeLabel,
  children,
}: {
  request: TravelRequest;
  settlement?: Settlement | null;
  /** Amount being decided / paid. */
  amount: string | number;
  /** Action-oriented status for whoever must act, e.g. "Awaiting your approval". */
  badgeLabel?: string;
  /** Action buttons, or a "nothing to do" note. */
  children: ReactNode;
}) {
  const waitingOn = waitingOnStep(request, settlement);
  return (
    <header className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-teal-950 sm:text-3xl">{request.travel_request_id}</h1>
          <StatusBadge status={request.status} settlementStatus={settlement?.status} label={badgeLabel} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {claimTitle(tripKindOf(request.travel_category))} — {formatRupees(Number(amount))} ·{" "}
          {request.employee_name} · {formatTripDates(request.start_date, request.end_date)}
          {waitingOn?.approver_name ? ` · with ${waitingOn.approver_name}` : ""}
        </p>
      </div>
      {children}
    </header>
  );
}

/** Trip progress with both approval chains inside the card. */
export function TripFlow({
  request,
  settlement,
  youId,
  captions,
}: {
  request: TravelRequest;
  settlement?: Settlement | null;
  /** Viewer's own pending step, tagged "(You)". */
  youId?: number;
  captions?: "all" | "active";
}) {
  const waitingOn = waitingOnStep(request, settlement);
  return (
    <TripProgress
      status={request.status}
      advance_requested={request.advance_requested}
      advance_disbursed={request.advance_disbursed}
      settlement_status={settlement?.status}
      pending_with={waitingOn?.approver_name ?? waitingOn?.role_required ?? null}
      captions={captions}
      title={claimTitle(tripKindOf(request.travel_category))}
    >
      {/* who signs off, level by level */}
      {request.approvals.length > 0 ? (
        <ApprovalChain title="Trip approval" approvals={request.approvals} youId={youId} />
      ) : null}
      {settlement && settlement.approvals.length > 0 ? (
        <ApprovalChain title="Finance Review" approvals={settlement.approvals} youId={youId} />
      ) : null}
    </TripProgress>
  );
}

/** Read-only claim lines for a settlement under review. */
export function ExpenseLinesCard({ settlement }: { settlement: Settlement }) {
  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  // Receipt open in the viewer
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-800">
        Claimed expenses
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Type</th>
              <th className={th}>Details</th>
              <th className={th}>Date</th>
              <th className={th}>Paid by</th>
              <th className={th}>Proof</th>
              <th className={`${th} text-right`}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {settlement.expenses.map((line, index) => {
              const { detail, when } = expenseSummary(line);
              return (
                <tr key={line.id ?? index}>
                  <td className="px-3 py-2.5 capitalize text-slate-900">{line.section}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {detail || "—"}
                    {Number(line.disallowed_amount ?? 0) > 0 ? (
                      <span className="block text-xs text-rose-700">
                        Disallowed ₹{formatAmountValue(line.disallowed_amount ?? "0")}
                        {line.disallow_reason ? ` · ${line.disallow_reason}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{when || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{line.paid_by}</td>
                  <td className={`px-3 py-2.5 ${line.proof_ref ? "text-slate-600" : "text-amber-700"}`}>
                    {receiptIdOf(line) ? (
                      <button
                        type="button"
                        onClick={() => setViewing(receiptIdOf(line))}
                        className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-900"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        {proofLabel(line)}
                      </button>
                    ) : (
                      proofLabel(line)
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">
                    {formatAmountValue(line.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {viewing ? (
        <ReceiptViewer
          key={viewing}
          travelRequestId={settlement.travel_request_id}
          receiptId={viewing}
          name={`Receipt #${viewing}`}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </section>
  );
}

/** Small figure card: label, amount, optional hint. */
function AmountCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}


/** Key figures: trip estimate / advance, or the settlement outcome once claimed. */
export function TripAmounts({
  request,
  settlement,
}: {
  request: TravelRequest;
  /** Pass to show settlement figures instead of the trip estimate. */
  settlement?: Settlement | null;
}) {
  const recoverable = settlement ? Number(settlement.amount_recoverable) > 0 : false;
  return (
    <section aria-label="Amounts" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {settlement ? (
        <>
          <AmountCard label="Claim total" value={formatRupees(settlement.total_employee_paid)} hint="Paid by the employee" />
          <AmountCard label="Disallowed" value={formatRupees(settlement.disallowed_total)} hint="Policy deductions" />
          <AmountCard label="Advance applied" value={formatRupees(settlement.advance_applied)} />
          <AmountCard
            label={recoverable ? "Recoverable" : "Payable"}
            value={formatRupees(recoverable ? settlement.amount_recoverable : settlement.amount_payable)}
            hint={recoverable ? "From payroll" : "To the employee"}
          />
        </>
      ) : (
        <>
          <AmountCard label="Estimated cost" value={formatRupees(request.estimated_cost)} />
          <AmountCard label="Advance requested" value={formatRupees(request.advance_requested)} />
          <AmountCard label="Advance released" value={formatRupees(request.advance_disbursed)} />
          <AmountCard label="Cost heads" value={String(request.estimated_heads.length)} />
        </>
      )}
    </section>
  );
}

/** Settlement entry on the trip page: start / continue / fix / view, with the claim so far. */
export function SettlementCard({
  settlement,
  to,
  editable,
}: {
  settlement: Settlement | null;
  to: string;
  /** Requester can still add or change expenses. */
  editable: boolean;
}) {
  // Lines the employee added (desk bookings are seeded automatically)
  const count = settlement?.expenses.filter((line) => !isDeskLine(line)).length ?? 0;
  const returned = editable && (settlement?.approvals.some((step) => step.decision === "returned") ?? false);
  const claim = settlement
    ? `${count} expense${count === 1 ? "" : "s"} · ${formatRupees(settlement.net_reimbursable)} net claim`
    : "";
  const [text, cta] = !editable
    ? [claim, "View settlement"]
    : returned
      ? ["Sent back for changes — update your expenses and submit again.", "Fix settlement"]
      : count === 0
        ? ["Upload your bills and receipts to claim expenses against this trip.", "Start settlement"]
        : [`${claim} · draft, not submitted yet`, "Continue settlement"];
  return (
    <Link
      to={to}
      className={`group block rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        returned ? "border-amber-300" : editable ? "border-teal-300" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">Settlement</h2>
          <p className="mt-1 text-sm text-slate-600">{text}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 group-hover:text-teal-800">
          {cta}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/** Compact, clickable summary of the request; the full form opens on its own page. */
export function TripSummaryCard({ request, to }: { request: TravelRequest; to: string }) {
  const facts: [string, string][] = [
    ["Destination", request.destination ?? NOT_SET],
    ["Dates", formatTripDates(request.start_date, request.end_date)],
    ["Category", request.travel_category],
    ["Mode", request.travel_mode],
  ];
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">Travel request</h2>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 group-hover:text-teal-800">
          View full request
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="truncate font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{request.purpose}</p>
    </Link>
  );
}
