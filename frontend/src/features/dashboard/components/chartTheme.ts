/** Shared Recharts styling for dashboard and report charts. */
import { formatRupees } from "@/lib/money";

export const COLOR = {
  teal: "#0d9488",
  sky: "#7dd3fc",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  emerald: "#10b981",
  slate: "#cbd5e1",
  grid: "#e2e8f0",
};

/** Cycled for categorical slices (departments, expense types). */
export const SERIES = [COLOR.teal, COLOR.sky, COLOR.amber, COLOR.violet, COLOR.emerald, COLOR.rose];

export const AXIS = { fontSize: 11, fill: "#64748b" };

// keep legend items in series order instead of Recharts' alphabetical default
export const LEGEND_PROPS = {
  iconType: "circle",
  iconSize: 8,
  itemSorter: null,
  wrapperStyle: { fontSize: 12 },
} as const;

export const rupeeTooltip = (value: unknown) =>
  value == null ? "Not settled" : formatRupees(Number(value));
