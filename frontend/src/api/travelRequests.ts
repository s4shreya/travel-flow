import { apiFetch } from "@/api/client";
import type {
  TravelRequest,
  TravelRequestCreatePayload,
} from "@/types/travelRequest";

export interface TravelRequestListItem {
  travel_request_id: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  estimated_cost: string;
  advance_requested: string;
  advance_disbursed: string;
  created_at: string;
  /** Requester (Finance queues). */
  employee_name?: string | null;
  progress_label?: string | null;
  pending_with?: string | null;
  settlement_status?: string | null;
  settlement_amount_payable?: string | null;
  settlement_amount_recoverable?: string | null;
  // Dashboard analytics
  settlement_actual_spend?: string | null;
  settlement_expense_split?: ExpenseSplit[] | null;
}

/** Settlement spend for one expense section (lodging / transport / other). */
export interface ExpenseSplit {
  section: string;
  employee_paid: string;
  company_paid: string;
  disallowed: string;
}

const BASE = "/api/travel-requests";

/** POST /api/travel-requests */
export function createTravelRequest(
  payload: TravelRequestCreatePayload,
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(BASE, { method: "POST", body: payload });
}

export function listMyTravelRequests(): Promise<TravelRequestListItem[]> {
  return apiFetch<TravelRequestListItem[]>(BASE);
}

export function getTravelRequest(travelRequestId: string): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(`${BASE}/${travelRequestId}`);
}

export function updateTravelRequest(
  travelRequestId: string,
  payload: TravelRequestCreatePayload,
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(`${BASE}/${travelRequestId}`, {
    method: "PUT",
    body: payload,
  });
}

export function releaseAdvance(
  travelRequestId: string,
  amount: string,
  reference: string,
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(`${BASE}/${travelRequestId}/advance/release`, {
    method: "POST",
    body: { amount, reference },
  });
}

/** Finance declines the unpaid advance (reason required). */
export function declineAdvance(
  travelRequestId: string,
  remarks: string,
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(`${BASE}/${travelRequestId}/advance/decline`, {
    method: "POST",
    body: { remarks },
  });
}
