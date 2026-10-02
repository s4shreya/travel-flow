/** Date helpers: YYYY-MM-DD (local calendar) maths and en-IN display. */

import { plural } from "@/lib/text";

/** Parse YYYY-MM-DD as a local date (no UTC shift). */
export function parseIso(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Local calendar date as YYYY-MM-DD. */
export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIso(new Date(y, m - 1, d + days));
}

/** Whole days from start to end (YYYY-MM-DD); negative if end is earlier. */
export function daysBetween(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const diff = Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds);
  return Math.round(diff / 86_400_000);
}

function parseDate(value: string): Date | null {
  // Date-only strings are local dates; anything else (timestamps) via Date()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseIso(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "21 Sep 2026" */
export function formatDate(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Dates not set";
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) return `${start} – ${end}`;
  const sameMonth =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const startText = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
  }).format(from);
  return `${startText} – ${formatDate(end)}`;
}

/** Trip length in days, counting both the start and end day. */
export function tripDays(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}

/** "5 – 10 Oct 2026 (6 days)"*/
export function formatTripDates(start: string | null, end: string | null): string {
  if (!start || !end) return formatDateRange(start, end);
  return `${formatDateRange(start, end)} (${plural(tripDays(start, end), "day")})`;
}

/** Time-of-day greeting for the dashboard header. */
export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
