import { apiFetch } from "@/api/client";
import type {
  TravelRequest,
  TravelRequestCreatePayload,
} from "@/types/travelRequest";

export interface TravelRequestListItem {
  travel_request_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  estimated_cost: string;
  advance_requested: string;
  advance_disbursed: string;
  created_at: string;
  progress_label?: string | null;
  pending_with?: string | null;
  settlement_status?: string | null;
  settlement_amount_payable?: string | null;
  settlement_amount_recoverable?: string | null;
}

/** POST /api/travel-requests */
export function createTravelRequest(
  employeeCode: string,
  payload: TravelRequestCreatePayload
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>("/api/travel-requests", {
    method: "POST",
    employeeCode,
    body: payload,
  });
}

export function listMyTravelRequests(
  employeeCode: string
): Promise<TravelRequestListItem[]> {
  return apiFetch<TravelRequestListItem[]>("/api/travel-requests", {
    method: "GET",
    employeeCode,
  });
}

export function getTravelRequest(
  employeeCode: string,
  travelRequestId: string
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(`/api/travel-requests/${travelRequestId}`, {
    method: "GET",
    employeeCode,
  });
}

export function updateTravelRequest(
  employeeCode: string,
  travelRequestId: string,
  payload: TravelRequestCreatePayload
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(`/api/travel-requests/${travelRequestId}`, {
    method: "PUT",
    employeeCode,
    body: payload,
  });
}

export function releaseAdvance(
  employeeCode: string,
  travelRequestId: string,
  amount: string,
  reference: string
): Promise<TravelRequest> {
  return apiFetch<TravelRequest>(
    `/api/travel-requests/${travelRequestId}/advance/release`,
    {
      method: "POST",
      employeeCode,
      body: { amount, reference },
    }
  );
}
