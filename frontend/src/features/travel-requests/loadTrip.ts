import { getSettlement, type Settlement } from "@/api/settlements";
import { getTravelRequest } from "@/api/travelRequests";
import type { TravelRequest, TravelRequestStatus } from "@/types/travelRequest";

/** Trip has reached the settlement stage (closed too, so progress can tell "paid" from "rejected"). */
export function hasSettlementStage(status: TravelRequestStatus): boolean {
  return status === "approved" || status === "in_settlement" || status === "closed";
}

/** Load a trip and, once it can have one, its settlement. */
export async function loadTripWithSettlement(
  travelRequestId: string,
): Promise<{ trip: TravelRequest; settlement: Settlement | null }> {
  const trip = await getTravelRequest(travelRequestId);
  const settlement = hasSettlementStage(trip.status)
    ? await getSettlement(travelRequestId)
    : null;
  return { trip, settlement };
}
