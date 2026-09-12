import { useState } from "react";
import { Link } from "react-router-dom";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input, TextArea } from "@/components/ui/Field";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { EstimatedHeadsEditor } from "@/features/travel-requests/EstimatedHeadsEditor";
import {
  TRAVEL_CATEGORIES,
  TRAVEL_MODES,
  createInitialFormValues,
  sumEstimatedHeads,
  type TravelRequestFormValues,
} from "@/features/travel-requests/formModel";
import { useCreateTravelRequest } from "@/features/travel-requests/useCreateTravelRequest";
import { formatAmount, formatMoneyInput, maxAdvanceFor } from "@/lib/money";
import { formatDecision, formatRequestStatus } from "@/lib/statusLabels";

const CATEGORY_OPTIONS = TRAVEL_CATEGORIES.map((category) => ({
  value: category,
  label: category,
}));

const MODE_OPTIONS = TRAVEL_MODES.map((mode) => ({
  value: mode,
  label: mode,
}));

/** Local calendar date as YYYY-MM-DD (no past selection for travel dates). */
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface TravelRequestFormProps {
  editId?: string;
  initialValues?: TravelRequestFormValues;
}

export function TravelRequestForm({
  editId,
  initialValues,
}: TravelRequestFormProps) {
  const today = todayIso();
  const [values, setValues] = useState<TravelRequestFormValues>(
    () => initialValues ?? createInitialFormValues(),
  );
  const { submitting, errors, apiError, created, submit, clearFeedback, reset } =
    useCreateTravelRequest(editId);

  const estimatedCost = sumEstimatedHeads(values.estimated_heads);
  const maxAdvance = maxAdvanceFor(
    Number.isFinite(estimatedCost) ? estimatedCost : 0,
  );

  function patch<K extends keyof TravelRequestFormValues>(
    key: K,
    value: TravelRequestFormValues[K],
  ) {
    clearFeedback();
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleHeadsChange(
    heads: TravelRequestFormValues["estimated_heads"],
  ) {
    clearFeedback();
    const total = sumEstimatedHeads(heads);
    setValues((prev) => ({
      ...prev,
      estimated_heads: heads,
      estimated_cost: formatAmount(total),
    }));
  }

  function startAnother() {
    reset();
    setValues(createInitialFormValues());
  }

  if (created) {
    return (
      <div className="flex flex-col gap-6">
        <Alert tone="success" title="Travel request created">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p>
              ID <strong>{created.travel_request_id}</strong>
            </p>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-teal-900">
              {formatRequestStatus(created.status)}
            </span>
          </div>
          {created.approvals.length > 0 ? (
            <ul className="mt-3 list-disc pl-5">
              {created.approvals.map((step) => (
                <li key={step.id}>
                  Level {step.level}: {step.role_required} —{" "}
                  {formatDecision(step.decision)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2">Saved as draft.</p>
          )}
        </Alert>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={startAnother}>
            Create another
          </Button>
          <Link
            to={`/travel-requests/${created.travel_request_id}`}
            className="inline-flex items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-900"
          >
            View request
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(values, true);
      }}
    >
      {apiError ? (
        <Alert tone="error" title="Could not create request">
          {apiError}
        </Alert>
      ) : null}

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="start_date"
          label="From date"
          required
          error={errors.start_date}
        >
          <DatePicker
            id="start_date"
            value={values.start_date}
            min={today}
            max={values.end_date || undefined}
            placeholder="Select start date"
            onChange={(value) => patch("start_date", value)}
          />
        </Field>
        <Field id="end_date" label="To date" required error={errors.end_date}>
          <DatePicker
            id="end_date"
            value={values.end_date}
            min={values.start_date || today}
            placeholder="Select end date"
            onChange={(value) => patch("end_date", value)}
          />
        </Field>
        <Field
          id="destination"
          label="Destination"
          required
          error={errors.destination}
        >
          <Input
            id="destination"
            value={values.destination}
            onChange={(event) => patch("destination", event.target.value)}
            placeholder="City or location"
            required
          />
        </Field>
        <Field
          id="currency"
          label="Currency"
          required
          error={errors.currency}
        >
          <Input
            id="currency"
            value={values.currency}
            onChange={(event) => patch("currency", event.target.value)}
            maxLength={8}
            required
          />
        </Field>
        <Field
          id="travel_category"
          label="Travel category"
          required
          error={errors.travel_category}
        >
          <SelectMenu
            id="travel_category"
            value={values.travel_category}
            options={CATEGORY_OPTIONS}
            onChange={(value) =>
              patch(
                "travel_category",
                value as TravelRequestFormValues["travel_category"],
              )
            }
          />
        </Field>
        <Field
          id="travel_mode"
          label="Travel mode"
          required
          error={errors.travel_mode}
        >
          <SelectMenu
            id="travel_mode"
            value={values.travel_mode}
            options={MODE_OPTIONS}
            onChange={(value) =>
              patch(
                "travel_mode",
                value as TravelRequestFormValues["travel_mode"],
              )
            }
          />
        </Field>
      </section>

      <Field id="purpose" label="Purpose" required error={errors.purpose}>
        <TextArea
          id="purpose"
          value={values.purpose}
          onChange={(event) => patch("purpose", event.target.value)}
          placeholder="Purpose of the travel"
          required
        />
      </Field>

      <EstimatedHeadsEditor
        value={values.estimated_heads}
        error={errors.estimated_heads}
        onChange={handleHeadsChange}
      />

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="estimated_cost"
          label="Total estimated cost"
          required
          error={errors.estimated_cost}
        >
          <Input
            id="estimated_cost"
            inputMode="decimal"
            value={values.estimated_cost}
            readOnly
            aria-readonly="true"
            className="cursor-default bg-slate-50 text-slate-700"
          />
        </Field>
        <Field
          id="advance_requested"
          label="Advance requested"
          required
          hint={`Up to 60% of estimate (max ₹${formatAmount(maxAdvance)})`}
          error={errors.advance_requested}
        >
          <Input
            id="advance_requested"
            inputMode="decimal"
            value={values.advance_requested}
            onChange={(event) =>
              patch("advance_requested", formatMoneyInput(event.target.value))
            }
            required
          />
        </Field>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={() => void submit(values, false)}
        >
          Save as draft
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </form>
  );
}
