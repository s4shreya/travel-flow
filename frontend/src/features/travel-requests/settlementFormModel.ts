/** Settlement expense lines: API shape ↔ editable draft, plus display helpers. */

import type { ReceiptExpensePayload } from "@/api/receipts";
import type { SettlementExpense } from "@/api/settlements";
import { daysBetween, formatDate, formatDateRange } from "@/lib/dates";
import { formatMoneyInput, parseMoney, toApiAmount } from "@/lib/money";
import {
  DESCRIPTION_MAX,
  MAX_LODGING_NIGHTS,
  moneyError,
  outsideTripError,
} from "@/lib/validation";

export interface TripWindow {
  start_date: string | null;
  end_date: string | null;
}

/** Editable expense line: receipt payload + the receipt it is linked to (proof). */
export type ExpenseDraft = ReceiptExpensePayload & { proof_ref: string | null };

// Travel-desk onward / return travel and hotel, added (company-paid) when the trip is approved
const DESK_PROOFS = new Set(["DESK-FLIGHT", "DESK-RETURN", "DESK-HOTEL"]);

export function isDeskLine(line: Pick<SettlementExpense, "proof_ref">): boolean {
  return line.proof_ref != null && DESK_PROOFS.has(line.proof_ref);
}

/** Lines need a receipt (or a desk booking) before the claim can be submitted. */
export function needsReceipt(line: Pick<SettlementExpense, "proof_ref">): boolean {
  return !line.proof_ref;
}

/** Uploaded receipt behind a line (none for desk bookings or missing proof). */
export function receiptIdOf(line: Pick<SettlementExpense, "proof_ref">): string | null {
  return line.proof_ref && !isDeskLine(line) ? line.proof_ref : null;
}

/** Proof label: travel desk booking, receipt number, or missing. */
export function proofLabel(line: Pick<SettlementExpense, "proof_ref">): string {
  if (isDeskLine(line)) return "Travel desk";
  return line.proof_ref ? `Receipt #${line.proof_ref}` : "Missing";
}

export function emptyDraft(): ExpenseDraft {
  return {
    section: "other",
    paid_by: "Employee",
    amount: "",
    check_in: null,
    check_out: null,
    hotel_name: null,
    city: null,
    expense_date: null,
    expense_time: null,
    from_location: null,
    to_location: null,
    mode: null,
    head: null,
    description: null,
    disallowed_amount: "",
    disallow_reason: null,
    proof_ref: null,
  };
}

/** Saved line → editable draft. */
export function toDraft(line: SettlementExpense): ExpenseDraft {
  // Keep the policy deduction set from the receipt scan
  const disallowed = Number(line.disallowed_amount ?? 0);
  return {
    ...emptyDraft(),
    section: line.section,
    paid_by: line.paid_by,
    amount: formatMoneyInput(String(line.amount ?? "")),
    check_in: line.check_in ?? null,
    check_out: line.check_out ?? null,
    hotel_name: line.hotel_name ?? null,
    city: line.city ?? null,
    expense_date: line.expense_date ?? null,
    expense_time: line.expense_time ? String(line.expense_time).slice(0, 5) : null,
    from_location: line.from_location ?? null,
    to_location: line.to_location ?? null,
    mode: line.mode ?? null,
    head: line.head ?? null,
    description: line.description ?? null,
    disallowed_amount: disallowed > 0 ? formatMoneyInput(String(line.disallowed_amount)) : "",
    disallow_reason: disallowed > 0 ? line.disallow_reason ?? null : null,
    proof_ref: line.proof_ref,
  };
}

/** Draft → API line with only its section's fields; company-paid lines carry no deduction. */
export function toExpense(draft: ExpenseDraft): SettlementExpense {
  const amount = parseMoney(draft.amount) || 0;
  // Disallowed part never exceeds the bill
  const disallowed =
    draft.paid_by === "Employee" ? Math.min(parseMoney(draft.disallowed_amount ?? "") || 0, amount) : 0;
  const base = {
    section: draft.section,
    paid_by: draft.paid_by,
    amount: toApiAmount(amount),
    proof_ref: draft.proof_ref || null,
    disallowed_amount: toApiAmount(disallowed),
    disallow_reason: disallowed > 0 ? draft.disallow_reason?.trim() || "Policy limit" : null,
  };
  if (draft.section === "lodging") {
    return {
      ...base,
      check_in: draft.check_in,
      check_out: draft.check_out,
      hotel_name: draft.hotel_name?.trim() ?? null,
      city: draft.city?.trim() ?? null,
    };
  }
  if (draft.section === "transport") {
    return {
      ...base,
      expense_date: draft.expense_date,
      expense_time: draft.expense_time || null,
      from_location: draft.from_location?.trim() ?? null,
      to_location: draft.to_location?.trim() ?? null,
      mode: draft.mode,
    };
  }
  return {
    ...base,
    expense_date: draft.expense_date,
    head: draft.head?.trim() ?? null,
    description: draft.description?.trim() || null,
  };
}

export type ExpenseErrors = Partial<Record<keyof ReceiptExpensePayload | "form", string>>;

/** Client-side validation matching settlement expense rules. */
export function validateExpense(draft: ExpenseDraft, trip?: TripWindow): ExpenseErrors {
  const errors: ExpenseErrors = {};

  // Outside the trip window
  const dateError = (value?: string | null) => outsideTripError(value, trip);

  const amountError = moneyError(draft.amount, { positive: true });
  if (amountError) errors.amount = amountError;

  // Disallowed part: never more than the bill, and always explained
  if (draft.paid_by === "Employee" && draft.disallowed_amount?.trim()) {
    const disallowedError = moneyError(draft.disallowed_amount);
    const disallowed = parseMoney(draft.disallowed_amount) || 0;
    if (disallowedError) errors.disallowed_amount = disallowedError;
    else if (!amountError && disallowed > (parseMoney(draft.amount) || 0)) {
      errors.disallowed_amount = "Disallowed amount cannot exceed the bill amount";
    } else if (disallowed > 0 && !draft.disallow_reason?.trim()) {
      errors.disallow_reason = "Give a reason for the disallowed amount";
    }
  }
  if ((draft.disallow_reason?.trim().length ?? 0) > 255) {
    errors.disallow_reason = "Reason cannot exceed 255 characters";
  }

  if (draft.section === "lodging") {
    if (!draft.check_in) errors.check_in = "Check-in is required";
    if (!draft.check_out) errors.check_out = "Check-out is required";
    if (draft.check_in && draft.check_out && draft.check_out < draft.check_in) {
      errors.check_out = "Check-out must be on or after check-in";
    } else if (
      draft.check_in &&
      draft.check_out &&
      daysBetween(draft.check_in, draft.check_out) > MAX_LODGING_NIGHTS
    ) {
      errors.check_out = `A single stay cannot exceed ${MAX_LODGING_NIGHTS} nights`;
    }
    const checkInError = dateError(draft.check_in);
    if (checkInError) errors.check_in = checkInError;
    const checkOutError = dateError(draft.check_out);
    if (checkOutError && !errors.check_out) errors.check_out = checkOutError;
    if (!draft.hotel_name?.trim()) errors.hotel_name = "Hotel is required";
    if (!draft.city?.trim()) errors.city = "City is required";
  } else if (draft.section === "transport") {
    if (!draft.expense_date) errors.expense_date = "Date is required";
    else {
      const error = dateError(draft.expense_date);
      if (error) errors.expense_date = error;
    }
    if (!draft.from_location?.trim()) {
      errors.from_location = "From location is required";
    }
    if (!draft.to_location?.trim()) {
      errors.to_location = "To location is required";
    }
    if (!draft.mode?.trim()) errors.mode = "Mode is required";
  } else {
    if (!draft.expense_date) errors.expense_date = "Date is required";
    else {
      const error = dateError(draft.expense_date);
      if (error) errors.expense_date = error;
    }
    if (!draft.head?.trim()) errors.head = "Head is required";
    if ((draft.description?.trim().length ?? 0) > DESCRIPTION_MAX) {
      errors.description = `Description cannot exceed ${DESCRIPTION_MAX} characters`;
    }
  }

  return errors;
}

/** One-line summary of an expense line, by section. */
export function expenseSummary(line: SettlementExpense): { detail: string; when: string } {
  if (line.section === "lodging") {
    return {
      detail: [line.hotel_name, line.city, line.nights ? `${line.nights} nights` : null]
        .filter(Boolean)
        .join(" · "),
      when: line.check_in && line.check_out ? formatDateRange(line.check_in, line.check_out) : "",
    };
  }
  const detail =
    line.section === "transport"
      ? [`${line.from_location ?? ""} → ${line.to_location ?? ""}`, line.mode].filter(Boolean).join(" · ")
      : [line.head, line.description].filter(Boolean).join(" · ");
  return { detail, when: line.expense_date ? formatDate(line.expense_date) : "" };
}
