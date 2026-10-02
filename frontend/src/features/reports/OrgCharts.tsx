import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AmountBreakdown, ReportResponse } from "@/api/reports";
import { EXPENSE_SECTION_OPTIONS } from "@/config/options";
import { ChartCard } from "@/features/dashboard/components/ChartCard";
import { AXIS, COLOR, LEGEND_PROPS, SERIES, rupeeTooltip } from "@/features/dashboard/components/chartTheme";
import { formatCompactInr, formatRupees, moneyValue } from "@/lib/money";
import { formatRequestStatus } from "@/lib/statusLabels";

const SECTION_LABEL = Object.fromEntries(EXPENSE_SECTION_OPTIONS.map((o) => [o.value, o.label]));

/** "2026-10" → "Oct 26" */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(
    new Date(year, month - 1, 1),
  );
}

/** Breakdown rows as numbers for the charts. */
function toChart(rows: AmountBreakdown[], labels: Record<string, string> = {}) {
  return rows.map((row) => ({
    label: labels[row.label] ?? row.label,
    requests: row.requests,
    estimated: moneyValue(row.estimated),
    actual: moneyValue(row.actual),
  }));
}

/** Claimed vs approved over the trailing 12 months. */
export function ClaimedVsApprovedChart({ report }: { report: ReportResponse }) {
  const data = useMemo(
    () =>
      report.monthly.map((point) => ({
        month: monthLabel(point.month),
        claimed: moneyValue(point.claimed),
        approved: moneyValue(point.approved),
      })),
    [report.monthly],
  );
  const claimed = moneyValue(report.kpis.claimed_total);
  const approved = moneyValue(report.kpis.approved_total);

  return (
    <ChartCard
      title="Claimed vs approved"
      subtitle="Employee claims and Finance-approved amounts, last 12 months"
      info="Claimed is what employees paid and submitted; approved is the reimbursable amount after Finance review and policy deductions."
      footer={`${formatRupees(claimed)} claimed · ${formatRupees(approved)} approved · ${formatRupees(moneyValue(report.kpis.policy_savings))} disallowed under policy.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: COLOR.grid }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompactInr} width={56} />
          <Tooltip formatter={rupeeTooltip} />
          <Legend {...LEGEND_PROPS} />
          <Area type="monotone" dataKey="claimed" name="Claimed" stroke={COLOR.amber} fill={COLOR.amber} fillOpacity={0.15} strokeWidth={2} />
          <Area type="monotone" dataKey="approved" name="Approved" stroke={COLOR.teal} fill={COLOR.teal} fillOpacity={0.2} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Where the money goes: submitted spend by expense category (every payer). */
export function SpendByCategoryChart({ report }: { report: ReportResponse }) {
  const data = useMemo(
    () => toChart(report.by_expense_category, SECTION_LABEL),
    [report.by_expense_category],
  );
  const total = moneyValue(report.kpis.actual_spend);

  return (
    <ChartCard
      title="Where the money goes"
      subtitle="Submitted spend by expense category"
      info="All expense lines on submitted settlements, whether the employee or the company (travel desk) paid."
      footer={
        data.length === 0
          ? "Appears once settlements are submitted."
          : `${formatRupees(moneyValue(report.kpis.company_paid_total))} of ${formatRupees(total)} paid directly by the company.`
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="actual" nameKey="label" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((slice, index) => (
              <Cell key={slice.label} fill={SERIES[index % SERIES.length]} />
            ))}
            <Label value={formatCompactInr(total)} position="center" className="fill-slate-900 text-sm font-semibold" />
          </Pie>
          <Tooltip formatter={rupeeTooltip} />
          <Legend {...LEGEND_PROPS} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Estimated vs actual spend per department. */
export function SpendByDepartmentChart({ report }: { report: ReportResponse }) {
  const data = useMemo(() => toChart(report.by_department), [report.by_department]);
  const top = data[0];

  return (
    <ChartCard
      title="Spend by department"
      subtitle="Approved estimates against submitted actual spend"
      info="Estimated is the trip budget at request time; actual is every expense line on submitted settlements."
      footer={top ? `${top.label} leads with ${top.requests} request(s).` : "No requests in this period."}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 4 }} barGap={2}>
          <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: COLOR.grid }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompactInr} width={56} />
          <Tooltip formatter={rupeeTooltip} cursor={{ fill: "#f1f5f9" }} />
          <Legend {...LEGEND_PROPS} />
          <Bar dataKey="estimated" name="Estimated" fill={COLOR.sky} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="actual" name="Actual" fill={COLOR.teal} radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Requests by lifecycle status. */
export function RequestsByStatusChart({ report }: { report: ReportResponse }) {
  const data = useMemo(
    () => report.by_status.map((row) => ({ label: formatRequestStatus(row.status), count: row.count })),
    [report.by_status],
  );

  return (
    <ChartCard
      title="Requests by status"
      subtitle="Where submitted requests sit in the flow"
      info="Every non-draft travel request in the period, grouped by its current status."
      footer={`${report.kpis.open_requests} open · ${report.kpis.pending_approvals} waiting on approvers or Finance.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={{ stroke: COLOR.grid }} />
          <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} tickMargin={8} width={110} />
          <Tooltip formatter={(value) => `${value} request(s)`} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="count" name="Requests" fill={COLOR.violet} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
