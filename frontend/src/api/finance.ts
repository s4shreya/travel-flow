import { apiFetch } from "@/api/client";
import type { TravelRequestListItem } from "@/api/travelRequests";

export function fetchAdvancesQueue(
  employeeCode: string,
): Promise<TravelRequestListItem[]> {
  return apiFetch<TravelRequestListItem[]>("/api/finance/advances", {
    method: "GET",
    employeeCode,
  });
}

export function fetchSettlementPaymentsQueue(
  employeeCode: string,
): Promise<TravelRequestListItem[]> {
  return apiFetch<TravelRequestListItem[]>(
    "/api/finance/settlement-payments",
    { method: "GET", employeeCode },
  );
}
