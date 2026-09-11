import { MAX_ADVANCE_RATIO } from "@/config/env";

/** Parse a money input into a finite number, or NaN if invalid. */
export function parseMoney(value: string): number {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return NaN;
  return Number(normalized);
}

/** Format a number as INR-style amount for display (no currency symbol). */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Max advance allowed for an estimated cost (policy 60%). */
export function maxAdvanceFor(estimatedCost: number): number {
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) return 0;
  return Math.round(estimatedCost * MAX_ADVANCE_RATIO * 100) / 100;
}

/** Serialize a number for the API as a fixed 2-decimal string. */
export function toApiAmount(value: number): string {
  return value.toFixed(2);
}
