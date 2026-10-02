/** Client-side rules mirroring the API (backend/core/validators.py). */

import { addDays } from "@/lib/dates";
import { parseMoney } from "@/lib/money";

export const MAX_AMOUNT = 10_000_000; // ₹1 crore per single amount
export const MAX_TRIP_DAYS = 90;
export const MAX_DAYS_IN_ADVANCE = 365;
export const MAX_ESTIMATE_HEADS = 20;
export const MAX_LODGING_NIGHTS = 90;
export const TRIP_DATE_BUFFER_DAYS = 1;

export const PURPOSE_MIN = 10;
export const PURPOSE_MAX = 2000;
export const DESTINATION_MAX = 255;
export const DESCRIPTION_MAX = 1000;
// Approver / Finance comments
export const REMARKS_MIN = 3;
export const REMARKS_MAX = 2000;

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const RECEIPT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

interface MoneyRules {
  required?: boolean;
  /** Reject zero (expense lines, cost heads). */
  positive?: boolean;
}

/** Validate a money input string; returns an error message or undefined. */
export function moneyError(
  raw: string,
  { required = true, positive = false }: MoneyRules = {},
): string | undefined {
  if (!raw.trim()) return required ? "Amount is required" : undefined;
  const value = parseMoney(raw);
  if (!Number.isFinite(value)) return "Enter a valid amount";
  if (value < 0) return "Amount cannot be negative";
  if (positive && value === 0) return "Amount must be greater than zero";
  if (value > MAX_AMOUNT) return "Amount cannot exceed ₹1,00,00,000";
  // String check avoids float rounding (0.29 * 100 !== 29)
  if (/\.\d{3,}$/.test(raw.trim())) return "Use at most 2 decimal places";
  return undefined;
}

type TripDates = { start_date: string | null; end_date: string | null };

/** Allowed expense dates: the trip ± one travel day (also the date pickers' min / max). */
export function tripDateBounds(trip?: TripDates): { min?: string; max?: string } {
  if (!trip?.start_date || !trip.end_date) return {};
  return {
    min: addDays(trip.start_date, -TRIP_DATE_BUFFER_DAYS),
    max: addDays(trip.end_date, TRIP_DATE_BUFFER_DAYS),
  };
}

/** Expense dates must fall within the trip (± one travel day). */
export function outsideTripError(
  value: string | null | undefined,
  trip?: TripDates,
): string | undefined {
  const { min, max } = tripDateBounds(trip);
  if (!value || !min || !max) return undefined;
  if (value < min || value > max) return "Outside the trip dates";
  return undefined;
}

/** Validate a receipt file before uploading. */
export function receiptFileError(file: File): string | undefined {
  if (file.size === 0) return "The selected file is empty";
  if (file.size > RECEIPT_MAX_BYTES) return "Receipt must be 5 MB or smaller";
  if (!RECEIPT_TYPES.includes(file.type)) {
    return "Only PDF, JPG, PNG or WEBP receipts are allowed";
  }
  return undefined;
}

/** Basic email shape check (the server decides if the account exists). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
