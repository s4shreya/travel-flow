import type { ReceiptExpensePayload } from "@/api/receipts";
import { parseMoney } from "@/lib/money";

export type ReceiptExpenseErrors = Partial<
  Record<keyof ReceiptExpensePayload | "form", string>
>;

/** Client-side validation matching settlement expense rules. */
export function validateReceiptExpense(
  draft: ReceiptExpensePayload,
): ReceiptExpenseErrors {
  const errors: ReceiptExpenseErrors = {};
  const amount = parseMoney(draft.amount);

  if (!draft.amount.trim()) {
    errors.amount = "Amount is required";
  } else if (!Number.isFinite(amount) || amount < 0) {
    errors.amount = "Enter a valid amount";
  }

  if (draft.section === "lodging") {
    if (!draft.check_in) errors.check_in = "Check-in is required";
    if (!draft.check_out) errors.check_out = "Check-out is required";
    if (
      draft.check_in &&
      draft.check_out &&
      draft.check_out < draft.check_in
    ) {
      errors.check_out = "Check-out must be on or after check-in";
    }
    if (!draft.hotel_name?.trim()) errors.hotel_name = "Hotel is required";
    if (!draft.city?.trim()) errors.city = "City is required";
  } else if (draft.section === "transport") {
    if (!draft.expense_date) errors.expense_date = "Date is required";
    if (!draft.from_location?.trim()) {
      errors.from_location = "From location is required";
    }
    if (!draft.to_location?.trim()) {
      errors.to_location = "To location is required";
    }
    if (!draft.mode?.trim()) errors.mode = "Mode is required";
  } else {
    if (!draft.expense_date) errors.expense_date = "Date is required";
    if (!draft.head?.trim()) errors.head = "Head is required";
  }

  return errors;
}
