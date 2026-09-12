import type { SettlementExpense } from "@/api/settlements";
import { parseMoney, toApiAmount } from "@/lib/money";

export interface LodgingLine {
  check_in: string;
  check_out: string;
  hotel_name: string;
  city: string;
  paid_by: string;
  amount: string;
  proof_ref: string;
}

export interface TransportLine {
  expense_date: string;
  expense_time: string;
  from_location: string;
  to_location: string;
  mode: string;
  paid_by: string;
  amount: string;
  proof_ref: string;
}

export interface OtherLine {
  expense_date: string;
  head: string;
  description: string;
  paid_by: string;
  amount: string;
  proof_ref: string;
}

export type SettlementLineErrors = {
  lodging: Record<number, Partial<Record<keyof LodgingLine, string>>>;
  transport: Record<number, Partial<Record<keyof TransportLine, string>>>;
  other: Record<number, Partial<Record<keyof OtherLine, string>>>;
  form?: string;
};

export const EMPTY_LODGING: LodgingLine = {
  check_in: "",
  check_out: "",
  hotel_name: "",
  city: "",
  paid_by: "Employee",
  amount: "",
  proof_ref: "",
};

export const EMPTY_TRANSPORT: TransportLine = {
  expense_date: "",
  expense_time: "",
  from_location: "",
  to_location: "",
  mode: "Cab",
  paid_by: "Employee",
  amount: "",
  proof_ref: "",
};

export const EMPTY_OTHER: OtherLine = {
  expense_date: "",
  head: "",
  description: "",
  paid_by: "Employee",
  amount: "",
  proof_ref: "",
};

function isBlankLodging(row: LodgingLine): boolean {
  return !(
    row.check_in ||
    row.check_out ||
    row.hotel_name.trim() ||
    row.city.trim() ||
    row.amount.trim() ||
    row.proof_ref
  );
}

function isBlankTransport(row: TransportLine): boolean {
  // Ignore default mode ("Cab") so an unused blank row is not treated as filled
  return !(
    row.expense_date ||
    row.from_location.trim() ||
    row.to_location.trim() ||
    row.amount.trim() ||
    row.proof_ref
  );
}

function isBlankOther(row: OtherLine): boolean {
  return !(
    row.expense_date ||
    row.head.trim() ||
    row.description.trim() ||
    row.amount.trim() ||
    row.proof_ref
  );
}

function validateAmount(amount: string): string | undefined {
  if (!amount.trim()) return "Amount is required";
  const value = parseMoney(amount);
  if (!Number.isFinite(value) || value < 0) return "Enter a valid amount";
  return undefined;
}

/** Validate filled settlement rows; blank rows are ignored. */
export function validateSettlementForm(
  lodging: LodgingLine[],
  transport: TransportLine[],
  other: OtherLine[],
): SettlementLineErrors {
  const errors: SettlementLineErrors = {
    lodging: {},
    transport: {},
    other: {},
  };

  lodging.forEach((row, index) => {
    if (isBlankLodging(row)) return;
    const rowErrors: Partial<Record<keyof LodgingLine, string>> = {};
    if (!row.check_in) rowErrors.check_in = "Required";
    if (!row.check_out) rowErrors.check_out = "Required";
    if (row.check_in && row.check_out && row.check_out < row.check_in) {
      rowErrors.check_out = "Must be on/after check-in";
    }
    if (!row.hotel_name.trim()) rowErrors.hotel_name = "Required";
    if (!row.city.trim()) rowErrors.city = "Required";
    const amountError = validateAmount(row.amount);
    if (amountError) rowErrors.amount = amountError;
    if (Object.keys(rowErrors).length) errors.lodging[index] = rowErrors;
  });

  transport.forEach((row, index) => {
    if (isBlankTransport(row)) return;
    const rowErrors: Partial<Record<keyof TransportLine, string>> = {};
    if (!row.expense_date) rowErrors.expense_date = "Required";
    if (!row.from_location.trim()) rowErrors.from_location = "Required";
    if (!row.to_location.trim()) rowErrors.to_location = "Required";
    if (!row.mode.trim()) rowErrors.mode = "Required";
    const amountError = validateAmount(row.amount);
    if (amountError) rowErrors.amount = amountError;
    if (Object.keys(rowErrors).length) errors.transport[index] = rowErrors;
  });

  other.forEach((row, index) => {
    if (isBlankOther(row)) return;
    const rowErrors: Partial<Record<keyof OtherLine, string>> = {};
    if (!row.expense_date) rowErrors.expense_date = "Required";
    if (!row.head.trim()) rowErrors.head = "Required";
    const amountError = validateAmount(row.amount);
    if (amountError) rowErrors.amount = amountError;
    if (Object.keys(rowErrors).length) errors.other[index] = rowErrors;
  });

  const hasRowErrors =
    Object.keys(errors.lodging).length > 0 ||
    Object.keys(errors.transport).length > 0 ||
    Object.keys(errors.other).length > 0;

  const hasAnyLine =
    lodging.some((row) => !isBlankLodging(row)) ||
    transport.some((row) => !isBlankTransport(row)) ||
    other.some((row) => !isBlankOther(row));

  if (!hasAnyLine) {
    errors.form = "Add at least one complete expense line";
  } else if (hasRowErrors) {
    errors.form = "Fix the highlighted expense fields before saving";
  }

  return errors;
}

export function settlementHasErrors(errors: SettlementLineErrors): boolean {
  return Boolean(
    errors.form ||
      Object.keys(errors.lodging).length ||
      Object.keys(errors.transport).length ||
      Object.keys(errors.other).length,
  );
}

/** Build API expense payload from complete (non-blank, valid) rows. */
export function toSettlementExpenses(
  lodging: LodgingLine[],
  transport: TransportLine[],
  other: OtherLine[],
): SettlementExpense[] {
  return [
    ...lodging
      .filter((row) => !isBlankLodging(row))
      .map((row) => ({
        section: "lodging" as const,
        check_in: row.check_in,
        check_out: row.check_out,
        hotel_name: row.hotel_name.trim(),
        city: row.city.trim(),
        paid_by: row.paid_by as "Employee" | "Company",
        amount: toApiAmount(parseMoney(row.amount) || 0),
        proof_ref: row.proof_ref || null,
      })),
    ...transport
      .filter((row) => !isBlankTransport(row))
      .map((row) => ({
        section: "transport" as const,
        expense_date: row.expense_date,
        expense_time: row.expense_time || null,
        from_location: row.from_location.trim(),
        to_location: row.to_location.trim(),
        mode: row.mode.trim(),
        paid_by: row.paid_by as "Employee" | "Company",
        amount: toApiAmount(parseMoney(row.amount) || 0),
        proof_ref: row.proof_ref || null,
      })),
    ...other
      .filter((row) => !isBlankOther(row))
      .map((row) => ({
        section: "other" as const,
        expense_date: row.expense_date,
        head: row.head.trim(),
        description: row.description.trim() || null,
        paid_by: row.paid_by as "Employee" | "Company",
        amount: toApiAmount(parseMoney(row.amount) || 0),
        proof_ref: row.proof_ref || null,
      })),
  ];
}
