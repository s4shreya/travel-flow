import { MAX_ADVANCE_RATIO } from "@/config/env";

/** Parse a money input into a finite number, or NaN if invalid. */
export function parseMoney(value: string): number {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return NaN;
  return Number(normalized);
}

/** Group an integer digit string in the Indian system: 10,00,000 */
function formatIndianInteger(digits: string): string {
  if (!digits) return "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  if (normalized.length <= 3) return normalized;
  const lastThree = normalized.slice(-3);
  const rest = normalized.slice(0, -3);
  const groups: string[] = [];
  for (let i = rest.length; i > 0; i -= 2) {
    groups.unshift(rest.slice(Math.max(0, i - 2), i));
  }
  return `${groups.join(",")},${lastThree}`;
}

/**
 * Format a typed money string with Indian commas while typing.
 * Keeps an optional decimal part (max 2 digits).
 */
export function formatMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  const hasDot = cleaned.includes(".");
  const [intRaw = "", ...decParts] = cleaned.split(".");
  const intDigits = intRaw.replace(/\D/g, "");
  const decDigits = decParts.join("").replace(/\D/g, "").slice(0, 2);

  if (!intDigits && !hasDot) return "";

  const formattedInt = formatIndianInteger(intDigits || "0");
  if (hasDot) return `${formattedInt}.${decDigits}`;
  return formattedInt;
}

/** Format a number as INR-style amount for display (no currency symbol). */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format an API/decimal string (or number) for INR display. */
export function formatAmountValue(value: string | number): string {
  const amount =
    typeof value === "number" ? value : parseMoney(String(value));
  if (!Number.isFinite(amount)) return String(value);
  return formatAmount(amount);
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
