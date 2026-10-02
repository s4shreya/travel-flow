import { useMemo } from "react";
import {
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

import type { TravelRequestListItem } from "@/api/travelRequests";
import { ChartCard } from "@/features/dashboard/components/ChartCard";
import { AXIS, COLOR, LEGEND_PROPS, rupeeTooltip } from "@/features/dashboard/components/chartTheme";
import {
  advanceVsActual,
  spendBySection,
  tripPipeline,
  type StageKey,
} from "@/features/dashboard/analytics";
import { formatCompactInr, formatRupees, sumMoney } from "@/lib/money";

// Same hues as StatusBadge so a stage looks the same everywhere
const STAGE_COLOR: Record<StageKey, string> = {
  draft: "#94a3b8",
  approval: "#f59e0b",
  approved: "#0ea5e9",
  settlement: "#8b5cf6",
  completed: "#10b981",
  rejected: "#f43f5e",
};

export function SpendAnalytics({ trips }: { trips: TravelRequestListItem[] }) {
  // shape the chart data once per load
  const stages = useMemo(() => tripPipeline(trips), [trips]);
  const sections = useMemo(() => spendBySection(trips), [trips]);
  const tripMoney = useMemo(() => advanceVsActual(trips), [trips]);

  if (trips.length === 0) return null;

  // takeaway numbers for the footers
  const waiting = trips.filter((trip) => trip.pending_with).length;
  const disallowed = sections.reduce((sum, s) => sum + s.disallowed, 0);
  const companyPaid = sections.reduce((sum, s) => sum + s.companyPaid, 0);
  const recovered = sumMoney(trips, (trip) => trip.settlement_amount_recoverable);
  const reimbursed = sumMoney(trips, (trip) => trip.settlement_amount_payable);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {/* where every trip sits in the flow */}
      <ChartCard
        title="Trip pipeline"
        subtitle="Your trips by stage of the flow"
        info="Counts your trips at each stage, from draft through approval, settlement and payout."
        footer={`${waiting} waiting on approvers or Finance.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={stages} dataKey="count" nameKey="label" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
              {stages.map((stage) => (
                <Cell key={stage.key} fill={STAGE_COLOR[stage.key]} />
              ))}
              <Label value={`${trips.length} trips`} position="center" className="fill-slate-900 text-sm font-semibold" />
            </Pie>
            <Tooltip formatter={(value) => `${value} trip(s)`} />
            <Legend {...LEGEND_PROPS} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* settled spend by expense section, with policy deductions */}
      <ChartCard
        title="Spend by expense type"
        subtitle="Settled lodging, transport and other expenses"
        info="Splits settled spend into what you are reimbursed, what policy disallowed, and what the company paid directly."
        footer={
          sections.length === 0
            ? "Appears once a settlement has expense lines."
            : `${disallowed > 0 ? `${formatRupees(disallowed)} disallowed under policy` : "No policy deductions"} · ${formatRupees(companyPaid)} paid directly by the company.`
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sections} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: COLOR.grid }} tickFormatter={formatCompactInr} />
            <YAxis type="category" dataKey="section" tick={AXIS} tickLine={false} axisLine={false} tickMargin={8} width={80} />
            <Tooltip formatter={rupeeTooltip} cursor={{ fill: "#f1f5f9" }} />
            <Legend {...LEGEND_PROPS} />
            <Bar dataKey="reimbursable" name="Reimbursable" stackId="spend" fill={COLOR.teal} maxBarSize={26} />
            <Bar dataKey="disallowed" name="Disallowed" stackId="spend" fill={COLOR.rose} maxBarSize={26} />
            <Bar dataKey="companyPaid" name="Company paid" stackId="spend" fill={COLOR.slate} radius={[0, 4, 4, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* budget, advance and real cost per trip */}
      <ChartCard
        title="Advance versus actual"
        subtitle="Your latest trips: estimate, advance received and real cost"
        info="Shows whether the advance covered the trip — unspent advance is recovered from payroll, extra spend is reimbursed."
        footer={`Settled so far: ${formatRupees(recovered)} recovered from advances · ${formatRupees(reimbursed)} reimbursed to you.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tripMoney} margin={{ top: 4, right: 8, bottom: 0, left: 4 }} barGap={2}>
            <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="trip" tick={AXIS} tickLine={false} axisLine={{ stroke: COLOR.grid }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompactInr} width={56} />
            <Tooltip formatter={rupeeTooltip} cursor={{ fill: "#f1f5f9" }} labelFormatter={(id) => `TRQ-${id}`} />
            <Legend {...LEGEND_PROPS} />
            <Bar dataKey="estimate" name="Estimate" fill={COLOR.sky} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="advance" name="Advance" fill={COLOR.amber} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="actual" name="Actual" fill={COLOR.teal} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
