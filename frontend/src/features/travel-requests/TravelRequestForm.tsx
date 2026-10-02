import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input, TextArea } from "@/components/ui/Field";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { TripProgress } from "@/components/ui/TripProgress";
import { useConfirm } from "@/hooks/useConfirm";
import { toOptions } from "@/config/options";
import { MAX_ADVANCE_PERCENT } from "@/config/policy";
import { EstimatedHeadsEditor } from "@/features/travel-requests/EstimatedHeadsEditor";
import {
  DOMESTIC_CATEGORIES,
  TRAVEL_MODES,
  createInitialFormValues,
  sumEstimatedHeads,
  tripKindOf,
  type TravelRequestFormValues,
  type TripKind,
} from "@/features/travel-requests/formModel";
import { useCreateTravelRequest } from "@/features/travel-requests/useCreateTravelRequest";
import { useIndianCities } from "@/lib/cities";
import {
  formatAmount,
  formatAmountValue,
  formatMoneyInput,
  maxAdvanceFor,
  parseMoney,
} from "@/lib/money";
import { previewSteps } from "@/lib/tripProgress";
import {
  DESTINATION_MAX,
  MAX_DAYS_IN_ADVANCE,
  MAX_TRIP_DAYS,
  PURPOSE_MAX,
} from "@/lib/validation";
import { addDays, todayIso, tripDays } from "@/lib/dates";
import { plural } from "@/lib/text";

const CATEGORY_OPTIONS = toOptions(DOMESTIC_CATEGORIES);
const MODE_OPTIONS = toOptions(TRAVEL_MODES);

interface TravelRequestFormProps {
  /** Claim type for a new request; edits derive it from the saved category. */
  kind?: TripKind;
  editId?: string;
  initialValues?: TravelRequestFormValues;
}

export function TravelRequestForm({
  kind,
  editId,
  initialValues,
}: TravelRequestFormProps) {
  // No past travel dates; plan at most a year ahead
  const today = todayIso();
  const latestStart = addDays(today, MAX_DAYS_IN_ADVANCE);
  const [values, setValues] = useState<TravelRequestFormValues>(
    () => initialValues ?? createInitialFormValues(kind),
  );
  const tripKind = kind ?? tripKindOf(values.travel_category);
  const isDomestic = tripKind === "domestic";
  const cities = useIndianCities(isDomestic);
  // On success the hook opens the request page with a toast
  const { submitting, errors, apiError, submit, clearFeedback } =
    useCreateTravelRequest(editId);
  const { confirm, dialog } = useConfirm();

  // "6 days" once both dates are picked
  const tripLength =
    values.start_date && values.end_date && values.end_date >= values.start_date
      ? plural(tripDays(values.start_date, values.end_date), "day")
      : undefined;

  const estimatedCost = sumEstimatedHeads(values.estimated_heads);
  const companyPaid = sumEstimatedHeads(values.estimated_heads, "Company");
  const maxAdvance = maxAdvanceFor(
    Number.isFinite(estimatedCost) ? estimatedCost : 0,
  );

  // Last check before the request goes to approvers
  function confirmSubmit() {
    const advance = parseMoney(values.advance_requested);
    return confirm({
      title: `Submit this ${tripKind} travel request?`,
      body: (
        <>
          ₹{formatAmountValue(estimatedCost)} is estimated
          {advance > 0 ? <>, with a ₹{formatAmountValue(advance)} advance</> : null}.
          A request number is issued and it heads into the approval chain, so
          your approvers are notified straight away. You can't edit it after
          submitting.
        </>
      ),
      confirmLabel: "Submit request",
    });
  }

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

  return (
    <form
      className="flex flex-col gap-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // Ignore double submits while a save is in flight
        if (submitting) return;
        void submit(values, true, confirmSubmit);
      }}
    >
      {/* What happens after you submit (new requests only) */}
      {!editId ? (
        <TripProgress
          steps={previewSteps()}
          title="What happens after you submit"
          hideSummary
        />
      ) : null}

      {apiError ? (
        <Alert tone="error" title="Could not save request">
          {apiError.includes("\n") ? (
            <ul className="list-disc pl-5">
              {apiError.split("\n").map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            apiError
          )}
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
            max={
              values.end_date && values.end_date < latestStart
                ? values.end_date
                : latestStart
            }
            placeholder="Select start date"
            onChange={(value) => patch("start_date", value)}
          />
        </Field>
        <Field
          id="end_date"
          label="To date"
          required
          hint={tripLength}
          error={errors.end_date}
        >
          <DatePicker
            id="end_date"
            value={values.end_date}
            min={values.start_date || today}
            max={
              values.start_date
                ? addDays(values.start_date, MAX_TRIP_DAYS - 1)
                : undefined
            }
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
          {/* Domestic: search Indian cities; international: free text */}
          {isDomestic ? (
            <Combobox
              id="destination"
              value={values.destination}
              options={cities}
              onChange={(value) => patch("destination", value)}
              placeholder="Search a city"
              maxLength={DESTINATION_MAX}
            />
          ) : (
            <Input
              id="destination"
              value={values.destination}
              onChange={(event) => patch("destination", event.target.value)}
              placeholder="City, Country"
              maxLength={DESTINATION_MAX}
              autoComplete="off"
              required
            />
          )}
        </Field>
        <Field
          id="currency"
          label="Currency"
          required
          hint={isDomestic ? "Domestic trips are in INR" : undefined}
          error={errors.currency}
        >
          {/* Domestic trips are always INR */}
          <Input
            id="currency"
            value={values.currency}
            onChange={(event) =>
              patch("currency", event.target.value.toUpperCase())
            }
            maxLength={3}
            readOnly={isDomestic}
            className={isDomestic ? "cursor-default bg-slate-50 text-slate-700" : ""}
            required
          />
        </Field>
        {/* City tier only applies within India */}
        {isDomestic ? (
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
        ) : null}
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

      <Field
        id="purpose"
        label="Purpose"
        required
        hint={`${values.purpose.trim().length}/${PURPOSE_MAX} characters`}
        error={errors.purpose}
      >
        <TextArea
          id="purpose"
          value={values.purpose}
          onChange={(event) => patch("purpose", event.target.value)}
          placeholder="e.g. Business visit to meet client"
          maxLength={PURPOSE_MAX}
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
          hint={
            companyPaid > 0
              ? `Employee-paid heads only · ₹${formatAmount(companyPaid)} Company-paid not included`
              : "Employee-paid heads only"
          }
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
          hint={`Up to ${MAX_ADVANCE_PERCENT} of estimate (max ₹${formatAmount(maxAdvance)})`}
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

      {/* submit confirmation popup */}
      {dialog}
    </form>
  );
}
