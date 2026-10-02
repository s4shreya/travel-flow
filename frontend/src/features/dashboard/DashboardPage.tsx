import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  ClipboardCheck,
  Clock,
  HandCoins,
  Plane,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEmployee } from "@/context/EmployeeContext";
import { QueueCard } from "@/features/dashboard/components/QueueCard";
import { SpendAnalytics } from "@/features/dashboard/components/SpendAnalytics";
import { StatRow, type StatTile } from "@/features/dashboard/components/StatRow";
import { DASHBOARD_ACTIONS } from "@/features/dashboard/config/actions";
import { useDashboardData } from "@/features/dashboard/useDashboardData";
import { FINANCE_TASK, financeRows } from "@/features/finance/financeTasks";
import { ClaimedVsApprovedChart, SpendByCategoryChart } from "@/features/reports/OrgCharts";
import { orgKpiTiles, type OrgKpiId } from "@/features/reports/orgKpis";
import { formatDate, formatTripDates, greeting, todayIso } from "@/lib/dates";
import { formatAmountValue, formatRupees as rupees, sumMoney as sum } from "@/lib/money";
import { paths } from "@/lib/routes";
import { plural } from "@/lib/text";

const RECENT_LIMIT = 5;
// Organisation tiles on the dashboard (full set lives on Reports)
const ORG_TILES: OrgKpiId[] = ["total-claims", "spend-month", "pending-org", "avg-days"];

export function DashboardPage() {
  const { employee, can } = useEmployee();
  const { data, loading, error } = useDashboardData();

  const actions = useMemo(
    () =>
      DASHBOARD_ACTIONS.filter(
        (action) => !action.capability || can(action.capability)
      ),
    [can]
  );

  // both Finance queues as one list (advances, payouts, recoveries)
  const financeQueue = useMemo(
    () => financeRows(data.advancesQueue, data.paymentsQueue),
    [data.advancesQueue, data.paymentsQueue],
  );

  // build role-aware KPI tiles from the loaded datasets
  const stats = useMemo(() => {
    const queues: StatTile[] = [];
    const personal: StatTile[] = [];
    const open = data.myRequests.filter((r) => r.status !== "closed");

    if (can("track_requests")) {
      const awaiting = open.filter((r) => r.pending_with);
      personal.push(
        {
          id: "active",
          label: "Active trips",
          info: "Your travel requests that are not closed yet, from draft through settlement.",
          value: String(open.length),
          hint: `${plural(data.myRequests.length, "request")} in total`,
          icon: Plane,
          accent: "teal",
          to: paths.myRequests,
        },
        {
          id: "awaiting",
          label: "Awaiting action",
          info: "Open trips currently waiting on an approver or Finance, not on you.",
          value: String(awaiting.length),
          hint: "Pending with approvers or Finance",
          icon: Clock,
          accent: "amber",
          to: paths.myRequests,
        },
        {
          id: "advance",
          label: "Advance received",
          info: "Travel advance Finance has already paid you for trips that are still open.",
          value: rupees(sum(open, (r) => r.advance_disbursed)),
          hint: "Across open requests",
          icon: HandCoins,
          accent: "sky",
        },
        {
          id: "payable",
          label: "Reimbursement due",
          info: "Approved settlement amounts the company still owes you after adjusting your advance.",
          value: rupees(sum(open, (r) => r.settlement_amount_payable)),
          hint: "Settlements payable to you",
          icon: Banknote,
          accent: "emerald",
        },
      );
    }

    if (can("approve_requests")) {
      const settlements = data.approvals.filter((a) => a.kind === "settlement").length;
      queues.push({
        id: "approvals",
        label: "Pending approvals",
        info: "Travel requests and settlements where you are the next approver in the chain.",
        value: String(data.approvals.length),
        hint: `${plural(data.approvals.length - settlements, "request")} · ${plural(settlements, "settlement")} · ${rupees(sum(data.approvals, (a) => a.amount))}`,
        icon: ClipboardCheck,
        accent: "amber",
        to: paths.approvals,
      });
    }

    if (can("release_funds")) {
      const advances = financeQueue.filter((r) => r.task.kind === "advance");
      const settlements = financeQueue.filter((r) => r.task.kind !== "advance");
      queues.push(
        {
          id: "advances-queue",
          label: "Advances to release",
          info: "Approved trips whose requested travel advance has not been paid out yet.",
          value: String(advances.length),
          hint: rupees(sum(advances, (r) => r.task.amount)),
          icon: Wallet,
          accent: "sky",
          to: paths.finance,
        },
        {
          id: "payments-queue",
          label: "Settlements to pay",
          info: "Approved settlements waiting for Finance to pay the employee or note a payroll recovery.",
          value: String(settlements.length),
          hint: rupees(sum(settlements, (r) => r.task.amount)),
          icon: ReceiptText,
          accent: "emerald",
          to: paths.finance,
        },
      );
    }

    // org-wide figures for Finance / Admin (from the report)
    const organisation = orgKpiTiles(data.report?.kpis ?? null, ORG_TILES);

    // everyone keeps their own tiles; approvers and Finance get a work-queue row too
    return { personal, queues, organisation };
  }, [data, can, financeQueue]);

  const recent = useMemo(
    () =>
      [...data.myRequests]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, RECENT_LIMIT),
    [data.myRequests]
  );

  const firstName = employee?.name.split(" ")[0] ?? "there";
  const today = formatDate(todayIso());

  return (
    <div className="flex flex-col gap-8 animate-in">
      {/* page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{today}</p>
          <h1 className="font-display mt-1 text-2xl text-slate-900 sm:text-3xl">
            {greeting()}, {firstName}
          </h1>
          {employee ? (
            <p className="mt-1 text-sm text-slate-600">
              {employee.designation} · {employee.department}
            </p>
          ) : null}
        </div>
        {can("create_request") ? (
          <Link
            to={paths.claims}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New Request
          </Link>
        ) : null}
      </header>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      {/* approvals + Finance queues */}
      <StatRow label="To review" tiles={stats.queues} loading={loading} />
      {/* organisation overview (Finance / Admin) */}
      <StatRow label="Organisation" tiles={stats.organisation} loading={loading} />
      {/* KPI tiles */}
      <StatRow label="My trips" tiles={stats.personal} loading={loading} />

      {/* org-wide charts */}
      {data.report && !loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ClaimedVsApprovedChart report={data.report} />
          <SpendByCategoryChart report={data.report} />
        </div>
      ) : null}

      {/* spend analytics */}
      {can("track_requests") && !loading ? <SpendAnalytics trips={data.myRequests} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* recent requests */}
        {can("track_requests") ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Recent travel requests</h2>
                <p className="text-xs text-slate-500">Your latest {RECENT_LIMIT} requests</p>
              </div>
              <Link
                to={paths.myRequests}
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800"
              >
                View all
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {loading ? (
              <ul className="divide-y divide-slate-100">
                {Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-40 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Plane className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">No travel requests yet</p>
                  <p className="text-sm text-slate-500">Plan your next business trip in a couple of minutes.</p>
                </div>
                {can("create_request") ? (
                  <Link
                    to={paths.claims}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Create request
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((request) => (
                  <li key={request.travel_request_id}>
                    <Link
                      to={paths.trip(request.travel_request_id)}
                      className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 sm:flex">
                        <Plane className="h-4 w-4 -rotate-45" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {request.destination}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          <span className="font-mono">{request.travel_request_id}</span>
                          {" · "}
                          {formatTripDates(request.start_date, request.end_date)}
                        </p>
                      </div>
                      <div className="hidden text-right md:block">
                        <p className="text-sm font-medium text-slate-900 tabular-nums">
                          ₹{formatAmountValue(request.estimated_cost)}
                        </p>
                        <p className="text-xs text-slate-500">Estimated</p>
                      </div>
                      <StatusBadge status={request.status} settlementStatus={request.settlement_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* side column */}
        <div className="flex flex-col gap-6">
          {can("approve_requests") ? (
            <QueueCard
              title="Awaiting your approval"
              loading={loading}
              items={data.approvals.map((item) => ({
                key: `${item.kind}-${item.approval_id}`,
                to: paths.review(item.travel_request_id),
                title: `${item.requester_name} · ${item.destination}`,
                subtitle: `${item.kind === "settlement" ? "Settlement" : "Travel request"} · Level ${item.level}`,
                amount: item.amount,
              }))}
            />
          ) : null}

          {/* Finance work: advances and settlement payouts */}
          {can("release_funds") ? (
            <QueueCard
              title="Waiting on Finance"
              loading={loading}
              items={financeQueue.map(({ row, task }) => ({
                key: `${task.kind}-${row.travel_request_id}`,
                to: paths.financeReview(row.travel_request_id),
                title: `${row.employee_name ?? row.travel_request_id} · ${row.destination}`,
                subtitle: FINANCE_TASK[task.kind].label,
                amount: task.amount,
              }))}
            />
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">
              Quick actions
            </h2>
            <ul className="p-2">
              {actions.map(({ id, title, description, to, icon: Icon }) => (
                <li key={id}>
                  <Link
                    to={to}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-slate-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{title}</p>
                      <p className="truncate text-xs text-slate-500">{description}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
