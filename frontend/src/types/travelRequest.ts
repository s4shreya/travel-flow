/** Domain types aligned with the TravelFlow API. */

export const TRAVEL_CATEGORIES = [
  "Domestic - Tier 1",
  "Domestic - Tier 2",
  "Domestic - Tier 3",
  "International",
] as const;

export const TRAVEL_MODES = ["Flight", "Rail", "Road", "Other"] as const;

export const BORNE_BY_OPTIONS = ["Company", "Employee"] as const;

export type TravelCategory = (typeof TRAVEL_CATEGORIES)[number];
export type TravelMode = (typeof TRAVEL_MODES)[number];
export type BorneBy = (typeof BORNE_BY_OPTIONS)[number];

export type TravelRequestStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "in_settlement"
  | "closed";

export type ApprovalDecision =
  | "pending"
  | "approved"
  | "returned"
  | "rejected"
  | "skipped";

export interface EstimatedHead {
  head: string;
  basis: string;
  amount: string;
  borne_by: BorneBy;
}

export interface TravelRequestCreatePayload {
  start_date: string;
  end_date: string;
  destination: string;
  purpose: string;
  travel_category: TravelCategory;
  travel_mode: TravelMode;
  currency: string;
  estimated_heads: EstimatedHead[];
  estimated_cost: string;
  advance_requested: string;
  submit: boolean;
}

export interface ApprovalStep {
  id: number;
  level: number;
  role_required: string;
  approver_id: number | null;
  decision: ApprovalDecision;
  remarks: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface TravelRequest {
  id: number;
  travel_request_id: string;
  employee_id: number;
  start_date: string;
  end_date: string;
  destination: string;
  purpose: string;
  travel_category: TravelCategory;
  travel_mode: TravelMode;
  currency: string;
  estimated_heads: EstimatedHead[];
  estimated_cost: string;
  advance_requested: string;
  advance_disbursed: string;
  status: TravelRequestStatus;
  created_at: string;
  updated_at: string;
  approvals: ApprovalStep[];
}

export interface ApiErrorBody {
  sub_status_code?: string;
  message?: string;
  details?: string;
}
