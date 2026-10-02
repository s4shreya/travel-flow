import { apiFetch } from "@/api/client";
import type { TravelRequestListItem } from "@/api/travelRequests";

export function fetchAdvancesQueue(): Promise<TravelRequestListItem[]> {
  return apiFetch<TravelRequestListItem[]>("/api/finance/advances");
}

export function fetchSettlementPaymentsQueue(): Promise<TravelRequestListItem[]> {
  return apiFetch<TravelRequestListItem[]>("/api/finance/settlement-payments");
}
