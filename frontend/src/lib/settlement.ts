/** Settlement outcome helpers shared by employee, approver and Finance screens. */

import type { Settlement } from "@/api/settlements";
import { formatAmountValue } from "@/lib/money";
import { advancePending } from "@/lib/tripProgress";
import type { TravelRequest } from "@/types/travelRequest";

type TripForSettlement = Pick<
  TravelRequest,
  "status" | "employee_id" | "advance_requested" | "advance_disbursed"
>;

/** Settlement opens once the trip is approved and the advance step is over (paid, declined or none). */
export function settlementOpen(trip: TripForSettlement): boolean {
  const approved = trip.status === "approved" || trip.status === "in_settlement";
  return approved && !advancePending(trip);
}

/** The requester can add / change expenses until the claim is submitted. */
export function settlementEditable(
  trip: TripForSettlement,
  settlement: Pick<Settlement, "status"> | null,
  employeeId: number | undefined,
): boolean {
  return (
    employeeId === trip.employee_id &&
    settlementOpen(trip) &&
    (!settlement || settlement.status === "draft" || settlement.status === "returned")
  );
}

interface Outcome {
  payable?: string | number | null;
  recoverable?: string | number | null;
}

/** Excess advance to recover from payroll (nothing to pay out). */
export function isRecovery({ payable, recoverable }: Outcome): boolean {
  return Number(recoverable || 0) > 0 && Number(payable || 0) <= 0;
}

/** " · payable ₹1,200.00 · recoverable ₹300.00" (only non-zero parts). */
export function outcomeSummary({ payable, recoverable }: Outcome): string {
  let text = "";
  if (Number(payable || 0) > 0) text += ` · payable ₹${formatAmountValue(payable!)}`;
  if (Number(recoverable || 0) > 0) {
    text += ` · recoverable ₹${formatAmountValue(recoverable!)}`;
  }
  return text;
}
