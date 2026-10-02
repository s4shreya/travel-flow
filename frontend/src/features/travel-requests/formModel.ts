import type {
  BorneBy,
  EstimatedHead,
  TravelCategory,
  TravelMode,
  TravelRequestCreatePayload,
} from "@/types/travelRequest";
import { EMPLOYEE_PAID, TRAVEL_CATEGORIES, TRAVEL_MODES } from "@/types/travelRequest";
import { MAX_ADVANCE_PERCENT } from "@/config/policy";
import { addDays, todayIso, tripDays } from "@/lib/dates";
import { formatAmount, maxAdvanceFor, parseMoney, toApiAmount } from "@/lib/money";
import {
  MAX_AMOUNT,
  MAX_DAYS_IN_ADVANCE,
  MAX_ESTIMATE_HEADS,
  MAX_TRIP_DAYS,
  PURPOSE_MAX,
  PURPOSE_MIN,
  moneyError,
} from "@/lib/validation";

export interface TravelRequestFormValues {
  start_date: string;
  end_date: string;
  destination: string;
  purpose: string;
  travel_category: TravelCategory;
  travel_mode: TravelMode;
  currency: string;
  estimated_heads: EstimatedHead[];
  estimated_cost: string;
  advance_requested: string;
}

export type FormErrors = Partial<
  Record<keyof TravelRequestFormValues | "form", string>
>;

/** Domestic trips pick a city tier; international trips use one category. */
export type TripKind = "domestic" | "international";

export const INTERNATIONAL_CATEGORY: TravelCategory = "International";

export const DOMESTIC_CATEGORIES = TRAVEL_CATEGORIES.filter(
  (category) => category !== INTERNATIONAL_CATEGORY,
);

export function tripKindOf(category: TravelCategory): TripKind {
  return category === INTERNATIONAL_CATEGORY ? "international" : "domestic";
}

/** Empty form defaults for a new travel request. */
export function createInitialFormValues(
  kind: TripKind = "domestic",
): TravelRequestFormValues {
  return {
    start_date: "",
    end_date: "",
    destination: "",
    purpose: "",
    travel_category:
      kind === "international" ? INTERNATIONAL_CATEGORY : "Domestic - Tier 1",
    travel_mode: "Flight",
    currency: "INR",
    estimated_heads: [
      { head: "", basis: "", amount: "", borne_by: EMPLOYEE_PAID },
    ],
    estimated_cost: "",
    advance_requested: "",
  };
}

/** Prefill the form from an existing travel request (edit draft). */
export function valuesFromTravelRequest(
  request: import("@/types/travelRequest").TravelRequest,
): TravelRequestFormValues {
  const heads =
    request.estimated_heads.length > 0
      ? request.estimated_heads.map((row) => ({
          head: row.head ?? "",
          basis: row.basis ?? "",
          amount: String(row.amount ?? ""),
          borne_by: (row.borne_by === "Employee" ? "Employee" : "Company") as
            | "Company"
            | "Employee",
        }))
      : [{ head: "", basis: "", amount: "", borne_by: EMPLOYEE_PAID }];

  return {
    start_date: request.start_date ?? "",
    end_date: request.end_date ?? "",
    destination: request.destination ?? "",
    purpose: request.purpose ?? "",
    travel_category: request.travel_category,
    travel_mode: request.travel_mode,
    currency: request.currency,
    estimated_heads: heads,
    estimated_cost: String(request.estimated_cost),
    advance_requested: String(request.advance_requested),
  };
}

/** Sum of the heads paid by `borneBy` (employee-paid by default). */
export function sumEstimatedHeads(
  heads: EstimatedHead[],
  borneBy: BorneBy = EMPLOYEE_PAID,
): number {
  return heads.reduce((total, row) => {
    if (row.borne_by !== borneBy) return total;
    const amount = parseMoney(row.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export function validateTravelRequestForm(
  values: TravelRequestFormValues,
): FormErrors {
  const errors: FormErrors = {};

  const today = todayIso();

  if (!values.start_date) errors.start_date = "From date is required";
  else if (values.start_date < today) {
    errors.start_date = "From date cannot be in the past";
  } else if (values.start_date > addDays(today, MAX_DAYS_IN_ADVANCE)) {
    errors.start_date = `Trips can be planned at most ${MAX_DAYS_IN_ADVANCE} days ahead`;
  }
  if (!values.end_date) errors.end_date = "To date is required";
  if (
    values.start_date &&
    values.end_date &&
    values.end_date < values.start_date
  ) {
    errors.end_date = "To date must be on or after from date";
  } else if (
    values.start_date &&
    values.end_date &&
    tripDays(values.start_date, values.end_date) > MAX_TRIP_DAYS
  ) {
    errors.end_date = `A single trip cannot exceed ${MAX_TRIP_DAYS} days`;
  }

  const destination = values.destination.trim();
  if (!destination) {
    errors.destination = "Destination is required";
  } else if (destination.length < 2 || !/\p{L}/u.test(destination)) {
    errors.destination = "Enter a valid city or location";
  }
  if (!values.currency.trim()) {
    errors.currency = "Currency is required";
  } else if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.currency = "Use a 3-letter code like INR";
  }
  if (!values.travel_category) {
    errors.travel_category = "Travel category is required";
  }
  if (!values.travel_mode) {
    errors.travel_mode = "Travel mode is required";
  }
  const purpose = values.purpose.trim();
  if (!purpose) {
    errors.purpose = "Purpose is required";
  } else if (purpose.length < PURPOSE_MIN) {
    errors.purpose = `Describe the purpose in at least ${PURPOSE_MIN} characters`;
  } else if (purpose.length > PURPOSE_MAX) {
    errors.purpose = `Purpose cannot exceed ${PURPOSE_MAX} characters`;
  }

  if (values.estimated_heads.length === 0) {
    errors.estimated_heads = "Add at least one cost head";
  } else if (values.estimated_heads.length > MAX_ESTIMATE_HEADS) {
    errors.estimated_heads = `Use at most ${MAX_ESTIMATE_HEADS} cost heads`;
  } else {
    for (const [index, head] of values.estimated_heads.entries()) {
      const label = head.head.trim() || `row ${index + 1}`;
      if (!head.head.trim()) {
        errors.estimated_heads = `Cost head #${index + 1} needs a name`;
        break;
      }
      if (!head.basis.trim()) {
        errors.estimated_heads = `“${label}” needs a basis`;
        break;
      }
      if (!head.amount.trim()) {
        errors.estimated_heads = `“${label}” estimate is required`;
        break;
      }
      const amountError = moneyError(head.amount, { positive: true });
      if (amountError) {
        errors.estimated_heads = `“${label}”: ${amountError.toLowerCase()}`;
        break;
      }
      if (head.borne_by !== "Company" && head.borne_by !== "Employee") {
        errors.estimated_heads = `“${label}” needs who bears the cost`;
        break;
      }
    }
  }

  // Total is always derived from employee-paid cost heads — never user-editable.
  const estimatedCost = sumEstimatedHeads(values.estimated_heads);
  if (!errors.estimated_heads && estimatedCost <= 0) {
    errors.estimated_cost = "Add at least one cost head paid by the employee";
  } else if (!errors.estimated_heads && estimatedCost > MAX_AMOUNT) {
    errors.estimated_cost = "Total estimated cost cannot exceed ₹1,00,00,000";
  }

  if (!values.advance_requested.trim()) {
    errors.advance_requested = "Advance requested is required";
  } else {
    const advance = parseMoney(values.advance_requested);
    const advanceError = moneyError(values.advance_requested);
    if (advanceError) {
      errors.advance_requested = advanceError;
    } else {
      const maxAdvance = maxAdvanceFor(estimatedCost);
      if (advance > maxAdvance) {
        errors.advance_requested = `Advance cannot exceed ${MAX_ADVANCE_PERCENT} of total estimated cost (max ${formatAmount(maxAdvance)})`;
      }
    }
  }

  return errors;
}

export function toCreatePayload(
  values: TravelRequestFormValues,
  submit: boolean,
): TravelRequestCreatePayload {
  const estimatedCost = sumEstimatedHeads(values.estimated_heads);
  const advance = parseMoney(values.advance_requested);

  return {
    start_date: values.start_date || null,
    end_date: values.end_date || null,
    destination: values.destination.trim() || null,
    purpose: values.purpose.trim() || null,
    travel_category: values.travel_category,
    travel_mode: values.travel_mode,
    currency: values.currency.trim().toUpperCase() || "INR",
    estimated_heads: values.estimated_heads.map((row) => {
      const amount = parseMoney(row.amount);
      return {
        head: row.head.trim(),
        basis: row.basis.trim(),
        amount: toApiAmount(Number.isFinite(amount) ? amount : 0),
        borne_by: row.borne_by,
      };
    }),
    estimated_cost: toApiAmount(estimatedCost),
    advance_requested: toApiAmount(Number.isFinite(advance) ? advance : 0),
    submit,
  };
}

export { TRAVEL_MODES };
