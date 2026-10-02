import { apiFetch } from "@/api/client";
import type { TravelRequestStatus } from "@/types/travelRequest";

/** Headline organisation figures (amounts are decimal strings, INR). */
export interface ReportKpis {
  total_requests: number;
  open_requests: number;
  travellers: number;
  estimated_total: string;
  claimed_total: string;
  approved_total: string;
  actual_spend: string;
  spend_this_month: string;
  company_paid_total: string;
  policy_savings: string;
  advances_disbursed: string;
  advances_outstanding: string;
  pending_approvals: number;
  awaiting_payment_count: number;
  awaiting_payment_amount: string;
  recoverable_amount: string;
  avg_days_to_decide: number | null;
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  requests: number;
  claimed: string;
  approved: string;
}

export interface AmountBreakdown {
  label: string;
  requests: number;
  estimated: string;
  actual: string;
}

export interface ReportRow {
  travel_request_id: string;
  employee_name: string;
  department: string;
  destination: string;
  travel_category: string;
  start_date: string;
  end_date: string;
  status: TravelRequestStatus;
  settlement_status: string | null;
  estimated_cost: string;
  advance_disbursed: string;
  actual_spend: string | null;
  net_reimbursable: string | null;
  disallowed: string | null;
}

export interface ReportResponse {
  date_from: string | null;
  date_to: string | null;
  kpis: ReportKpis;
  by_status: { status: TravelRequestStatus; count: number }[];
  monthly: MonthlyPoint[];
  by_department: AmountBreakdown[];
  by_expense_category: AmountBreakdown[];
  by_travel_category: AmountBreakdown[];
  rows: ReportRow[];
}

export interface ReportPeriod {
  dateFrom?: string;
  dateTo?: string;
}

/** Organisation report; optional period filters on trip start date. */
export function fetchReport({ dateFrom, dateTo }: ReportPeriod = {}): Promise<ReportResponse> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const query = params.toString();
  return apiFetch<ReportResponse>(`/api/reports${query ? `?${query}` : ""}`);
}
