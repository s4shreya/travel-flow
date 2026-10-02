import { BedDouble, Car, Receipt } from "lucide-react";

import type { Choice } from "@/components/ui/ChoiceCards";
import type { SettlementExpense } from "@/api/settlements";

export type ExpenseSection = SettlementExpense["section"];

/** Settlement sections, in display order (labels match EXPENSE_SECTION_OPTIONS). */
export const EXPENSE_SECTIONS: readonly Choice<ExpenseSection>[] = [
  { value: "lodging", label: "Lodging", hint: "Hotel stays", icon: BedDouble },
  { value: "transport", label: "Transport", hint: "Flights, rail, cabs", icon: Car },
  { value: "other", label: "Other", hint: "Meals, visa, misc", icon: Receipt },
];

export const PAID_BY_CHOICES: readonly Choice<SettlementExpense["paid_by"]>[] = [
  { value: "Employee", label: "Me", hint: "Reimbursed to you" },
  { value: "Company", label: "Company", hint: "Corporate card / desk" },
];
