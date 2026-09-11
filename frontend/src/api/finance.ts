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
