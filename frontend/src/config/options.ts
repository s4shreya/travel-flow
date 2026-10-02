/** Select options shared across forms. */

import type { SelectOption } from "@/components/ui/SelectMenu";

/** ["A", "B"] → [{ value: "A", label: "A" }, …] */
export function toOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}

// Settlement transport modes (parser in backend/src/receipts/parser.py uses the same set)
export const EXPENSE_MODE_OPTIONS = toOptions(["Flight", "Rail", "Cab", "Bus", "Other"]);

export const EXPENSE_SECTION_OPTIONS: SelectOption[] = [
  { value: "lodging", label: "Lodging" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];
