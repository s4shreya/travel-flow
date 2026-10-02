import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchReport, type ReportResponse, type ReportRow } from "@/api/reports";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { PageLoader } from "@/components/ui/Loader";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEmployee } from "@/context/EmployeeContext";
import { StatRow } from "@/features/dashboard/components/StatRow";
import {
  ClaimedVsApprovedChart,
  RequestsByStatusChart,
  SpendByCategoryChart,
  SpendByDepartmentChart,
} from "@/features/reports/OrgCharts";
import { orgKpiTiles, type OrgKpiId } from "@/features/reports/orgKpis";
import { downloadCsv } from "@/lib/csv";
import { formatTripDates, toIso, todayIso, tripDays } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { paths } from "@/lib/routes";
import { formatRequestStatus, formatSettlementStatus } from "@/lib/statusLabels";

const REPORT_TILES: OrgKpiId[] = [
  "total-claims",
  "actual-spend",
  "approved-total",
  "policy-savings",
  "advances",
  "awaiting-payment",
  "pending-org",
  "avg-days",
];

type PeriodKey = "all" | "month" | "quarter" | "fy";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Last 3 months" },
  { key: "fy", label: "This financial year" },
  { key: "all", label: "All time" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...["pending_approval", "approved", "in_settlement", "closed"].map((value) => ({
    value,
    label: formatRequestStatus(value),
  })),
];

/** Request raised-date range for a preset (Indian financial year starts 1 April). */
function periodRange(key: PeriodKey): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (key === "month") return { dateFrom: toIso(new Date(year, month, 1)), dateTo: todayIso() };
  if (key === "quarter") return { dateFrom: toIso(new Date(year, month - 2, 1)), dateTo: todayIso() };
  if (key === "fy") return { dateFrom: toIso(new Date(month >= 3 ? year : year - 1, 3, 1)), dateTo: todayIso() };
  return {};
}

const money = (value: string | null) => (value == null ? "—" : formatRupees(value));

/** Read-only organisation reporting: KPIs, charts and an exportable request register. */
export function ReportsPage() {
  const { can } = useEmployee();
  const allowed = can("view_reports");
  const canOpenTrips = can("view_all_requests");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    // load the report for the chosen period
    fetchReport(periodRange(period))
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // don't leave the previous period's figures on screen
        setReport(null);
        setError(errorMessage(err, "Failed to load the report"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, period]);

  function changePeriod(key: PeriodKey) {
    if (key === period) return;
    setLoading(true);
    setPeriod(key);
  }

  // filter the register by search text and status
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (report?.rows ?? []).filter(
      (row) =>
        (!status || row.status === status) &&
        (!needle ||
          [row.travel_request_id, row.employee_name, row.department, row.destination].some((field) =>
            field.toLowerCase().includes(needle),
          )),
    );
  }, [report, query, status]);

  const columns: Column<ReportRow>[] = [
    {
      key: "id",
      header: "Request",
      render: (row) =>
        canOpenTrips ? (
          <Link to={paths.trip(row.travel_request_id)} className="font-semibold text-teal-700 hover:underline">
            {row.travel_request_id}
          </Link>
        ) : (
          <span className="font-semibold text-slate-900">{row.travel_request_id}</span>
        ),
    },
    {
      key: "employee",
      header: "Employee",
      render: (row) => (
        <>
          <p className="font-medium text-slate-900">{row.employee_name}</p>
          <p className="text-xs text-slate-500">{row.department}</p>
        </>
      ),
    },
    {
      key: "trip",
      header: "Trip",
      render: (row) => (
        <>
          <p className="text-slate-900">{row.destination}</p>
          <p className="text-xs text-slate-500">
            {formatTripDates(row.start_date, row.end_date)} · {row.travel_category}
          </p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} settlementStatus={row.settlement_status} />,
    },
    { key: "estimated", header: "Estimated", align: "right", render: (row) => money(row.estimated_cost) },
    { key: "advance", header: "Advance", align: "right", render: (row) => money(row.advance_disbursed) },
    { key: "actual", header: "Actual", align: "right", render: (row) => money(row.actual_spend) },
    { key: "disallowed", header: "Disallowed", align: "right", render: (row) => money(row.disallowed) },
  ];

  function exportCsv() {
    const range = periodRange(period);
    downloadCsv(
      `travelflow-report-${range.dateFrom ?? "all"}-to-${range.dateTo ?? todayIso()}.csv`,
      [
        "Request", "Employee", "Department", "Destination", "Category", "Start", "End", "Days",
        "Status", "Settlement", "Estimated", "Advance", "Actual", "Net reimbursable", "Disallowed",
      ],
      rows.map((row) => [
        row.travel_request_id,
        row.employee_name,
        row.department,
        row.destination,
        row.travel_category,
        row.start_date,
        row.end_date,
        tripDays(row.start_date, row.end_date),
        formatRequestStatus(row.status),
        row.settlement_status ? formatSettlementStatus(row.settlement_status) : "",
        row.estimated_cost,
        row.advance_disbursed,
        row.actual_spend,
        row.net_reimbursable,
        row.disallowed,
      ]),
    );
  }

  if (!allowed) {
    return <Alert tone="error">You do not have access to reports.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        aside={
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0} className="gap-2">
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        }
      >
        <p className="text-sm text-slate-600">
          View travel and expense activity across Nortex.
        </p>
      </PageHeader>

      {/* period presets */}
      <div role="radiogroup" aria-label="Report period" className="flex flex-wrap gap-2">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={period === key}
            onClick={() => changePeriod(key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              period === key
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading && !report ? <PageLoader /> : null}

      {report ? (
        <>
          {/* headline figures */}
          <StatRow label="Key figures" tiles={orgKpiTiles(report.kpis, REPORT_TILES)} loading={loading} />

          {/* trends and breakdowns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ClaimedVsApprovedChart report={report} />
            <SpendByCategoryChart report={report} />
            <SpendByDepartmentChart report={report} />
            <RequestsByStatusChart report={report} />
          </div>

          {/* request register */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Request register</h2>
                <p className="text-xs text-slate-500">
                  {rows.length} of {report.rows.length} requests · export downloads the filtered list
                </p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <div className="relative min-w-56 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search request, employee, destination"
                    aria-label="Search requests"
                    className="pl-9"
                  />
                </div>
                <div className="w-48">
                  <SelectMenu id="report-status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                </div>
              </div>
            </div>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.travel_request_id}
              empty="No requests match these filters."
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
