import type {
  EstimatedHead,
  TravelCategory,
  TravelMode,
  TravelRequestCreatePayload,
} from "@/types/travelRequest";
import { TRAVEL_CATEGORIES, TRAVEL_MODES } from "@/types/travelRequest";
import { maxAdvanceFor, parseMoney, toApiAmount } from "@/lib/money";

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

/** Empty form defaults for a new travel request. */
export function createInitialFormValues(): TravelRequestFormValues {
  return {
    start_date: "",
    end_date: "",
    destination: "",
    purpose: "",
    travel_category: "Domestic - Tier 1",
    travel_mode: "Flight",
    currency: "INR",
    estimated_heads: [
      { head: "", basis: "", amount: "", borne_by: "Company" },
    ],
    estimated_cost: "",
    advance_requested: "",
  };
}

export function sumEstimatedHeads(heads: EstimatedHead[]): number {
  return heads.reduce((total, row) => {
    const amount = parseMoney(row.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export function validateTravelRequestForm(
  values: TravelRequestFormValues,
): FormErrors {
  const errors: FormErrors = {};

  const today = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  if (!values.start_date) errors.start_date = "From date is required";
  else if (values.start_date < today) {
    errors.start_date = "From date cannot be in the past";
  }
  if (!values.end_date) errors.end_date = "To date is required";
  if (
    values.start_date &&
    values.end_date &&
    values.end_date < values.start_date
  ) {
    errors.end_date = "To date must be on or after from date";
  }

  if (!values.destination.trim()) {
    errors.destination = "Destination is required";
  }
  if (!values.currency.trim()) {
    errors.currency = "Currency is required";
  }
  if (!values.travel_category) {
    errors.travel_category = "Travel category is required";
  }
  if (!values.travel_mode) {
    errors.travel_mode = "Travel mode is required";
  }
  if (!values.purpose.trim()) {
    errors.purpose = "Purpose is required";
  }

  if (values.estimated_heads.length === 0) {
    errors.estimated_heads = "Add at least one cost head";
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
      const amount = parseMoney(head.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        errors.estimated_heads = `“${label}” needs a valid estimate`;
        break;
      }
      if (head.borne_by !== "Company" && head.borne_by !== "Employee") {
        errors.estimated_heads = `“${label}” needs who bears the cost`;
        break;
      }
    }
  }

  // Total is always derived from cost heads — never user-editable.
  const estimatedCost = sumEstimatedHeads(values.estimated_heads);
  if (!errors.estimated_heads && estimatedCost <= 0) {
    errors.estimated_cost = "Total estimated cost must be greater than zero";
  }

  if (!values.advance_requested.trim()) {
    errors.advance_requested = "Advance requested is required";
  } else {
    const advance = parseMoney(values.advance_requested);
    if (!Number.isFinite(advance) || advance < 0) {
      errors.advance_requested = "Enter a valid advance amount";
    } else {
      const maxAdvance = maxAdvanceFor(estimatedCost);
      if (advance > maxAdvance) {
        errors.advance_requested = `Advance cannot exceed 60% of total estimated cost (max ${formatMax(maxAdvance)})`;
      }
    }
  }

  return errors;
}

function formatMax(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function toCreatePayload(
  values: TravelRequestFormValues,
  submit: boolean,
): TravelRequestCreatePayload {
  const estimatedCost = sumEstimatedHeads(values.estimated_heads);
  const advance = parseMoney(values.advance_requested);

  return {
    start_date: values.start_date,
    end_date: values.end_date,
    destination: values.destination.trim(),
    purpose: values.purpose.trim(),
    travel_category: values.travel_category,
    travel_mode: values.travel_mode,
    currency: values.currency.trim().toUpperCase() || "INR",
    estimated_heads: values.estimated_heads.map((row) => ({
      head: row.head.trim(),
      basis: row.basis.trim(),
      amount: toApiAmount(parseMoney(row.amount)),
      borne_by: row.borne_by,
    })),
    estimated_cost: toApiAmount(estimatedCost),
    advance_requested: toApiAmount(Number.isFinite(advance) ? advance : 0),
    submit,
  };
}

export { TRAVEL_CATEGORIES, TRAVEL_MODES };
