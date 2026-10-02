import {
  BadgeCheck,
  Banknote,
  Clock,
  HandCoins,
  Plane,
  ReceiptText,
  ShieldCheck,
  Timer,
  Wallet,
} from "lucide-react";

import type { ReportKpis } from "@/api/reports";
import type { StatTile } from "@/features/dashboard/components/StatRow";
import { formatRupees } from "@/lib/money";
import { paths } from "@/lib/routes";
import { plural } from "@/lib/text";

export type OrgKpiId =
  | "total-claims"
  | "spend-month"
  | "pending-org"
  | "avg-days"
  | "actual-spend"
  | "approved-total"
  | "policy-savings"
  | "advances"
  | "awaiting-payment";


/** Organisation KPI tiles in the order of `ids`. */
export function orgKpiTiles(kpis: ReportKpis | null, ids: OrgKpiId[]): StatTile[] {
  if (!kpis) return [];
  const tiles: Record<OrgKpiId, Omit<StatTile, "id">> = {
    "total-claims": {
      label: "Total claims",
      info: "Every submitted travel request in the organisation (drafts excluded).",
      value: String(kpis.total_requests),
      hint: `${kpis.open_requests} open · ${plural(kpis.travellers, "traveller")}`,
      icon: Plane,
      accent: "teal",
      to: paths.reports,
    },
    "spend-month": {
      label: "Organisation spend this month",
      info: "All expense lines on settlements submitted this calendar month, whoever paid.",
      value: formatRupees(kpis.spend_this_month),
      hint: "Submitted settlements",
      icon: Banknote,
      accent: "emerald",
      to: paths.reports,
    },
    "pending-org": {
      label: "Pending across the org",
      info: "Trip requests waiting on an approver plus settlements waiting on Finance review.",
      value: String(kpis.pending_approvals),
      hint: "Trip approvals and Finance reviews",
      icon: Clock,
      accent: "amber",
    },
    "avg-days": {
      label: "Average days to decide",
      info: "From a trip's first approval step to its final approve / reject decision.",
      value: kpis.avg_days_to_decide == null ? "—" : `${kpis.avg_days_to_decide} days`,
      hint: "Trip approvals",
      icon: Timer,
      accent: "sky",
    },
    "actual-spend": {
      label: "Total spend",
      info: "Every expense line on submitted settlements, employee- and company-paid.",
      value: formatRupees(kpis.actual_spend),
      hint: `${formatRupees(kpis.estimated_total)} estimated`,
      icon: ReceiptText,
      accent: "teal",
    },
    "approved-total": {
      label: "Approved for reimbursement",
      info: "Net reimbursable on settlements Finance has approved, after policy deductions.",
      value: formatRupees(kpis.approved_total),
      hint: `${formatRupees(kpis.claimed_total)} claimed by employees`,
      icon: BadgeCheck,
      accent: "emerald",
    },
    "policy-savings": {
      label: "Policy savings",
      info: "Amounts disallowed on employee claims for exceeding policy limits.",
      value: formatRupees(kpis.policy_savings),
      hint: "Disallowed under policy",
      icon: ShieldCheck,
      accent: "rose",
    },
    advances: {
      label: "Advances disbursed",
      info: "Travel advances Finance has paid out; outstanding is approved but not yet released.",
      value: formatRupees(kpis.advances_disbursed),
      hint: `${formatRupees(kpis.advances_outstanding)} still to release`,
      icon: HandCoins,
      accent: "sky",
    },
    "awaiting-payment": {
      label: "Approved awaiting payment",
      info: "Approved settlements Finance still has to pay out, plus excess advances to recover.",
      value: formatRupees(kpis.awaiting_payment_amount),
      hint: `${plural(kpis.awaiting_payment_count, "settlement")} · ${formatRupees(kpis.recoverable_amount)} to recover`,
      icon: Wallet,
      accent: "amber",
    },
  };
  return ids.map((id) => ({ id, ...tiles[id] }));
}
