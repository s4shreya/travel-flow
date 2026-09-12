import { useState } from "react";

import type { ReceiptExpensePayload } from "@/api/receipts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { SelectMenu } from "@/components/ui/SelectMenu";
import {
  validateReceiptExpense,
  type ReceiptExpenseErrors,
} from "@/features/travel-requests/receiptExpenseModel";

const SECTION_OPTIONS = [
  { value: "lodging", label: "Lodging" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const PAID_BY_OPTIONS = [
  { value: "Employee", label: "Employee" },
  { value: "Company", label: "Company" },
];

function emptyDraft(): ReceiptExpensePayload {
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
  };
}

interface ReceiptExpenseFormProps {
  receiptId: number;
  receiptName: string;
  travelRequestId: string;
  saving: boolean;
  apiError?: string | null;
  onCancel: () => void;
  onSave: (payload: ReceiptExpensePayload) => void;
}

export function ReceiptExpenseForm({
  receiptId,
  receiptName,
  travelRequestId,
  saving,
  apiError = null,
  onCancel,
  onSave,
}: ReceiptExpenseFormProps) {
  const [draft, setDraft] = useState<ReceiptExpensePayload>(emptyDraft);
  const [errors, setErrors] = useState<ReceiptExpenseErrors>({});

  function patch(partial: Partial<ReceiptExpensePayload>) {
    setErrors({});
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function handleSave() {
    const nextErrors = validateReceiptExpense(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(draft);
  }

  return (
    <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/40 p-4">
      <h3 className="text-sm font-semibold text-teal-950">
        Fill expense for this receipt
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        {receiptName} (#{receiptId}) for {travelRequestId}. Linked only to this
        travel request.
      </p>

      {apiError ? (
        <div className="mt-3">
          <Alert tone="error" title="Could not save expense">
            {apiError}
          </Alert>
        </div>
      ) : null}
      {errors.form ? (
        <div className="mt-3">
          <Alert tone="error">{errors.form}</Alert>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="receipt-section" label="Section" required>
          <SelectMenu
            id="receipt-section"
            value={draft.section}
            options={SECTION_OPTIONS}
            onChange={(value) =>
              patch({
                section: value as ReceiptExpensePayload["section"],
              })
            }
          />
        </Field>
        <Field id="receipt-paid-by" label="Paid by" required>
          <SelectMenu
            id="receipt-paid-by"
            value={draft.paid_by}
            options={PAID_BY_OPTIONS}
            onChange={(value) =>
              patch({ paid_by: value as ReceiptExpensePayload["paid_by"] })
            }
          />
        </Field>
        <Field
          id="receipt-amount"
          label="Amount (₹)"
          required
          error={errors.amount}
        >
          <Input
            id="receipt-amount"
            type="number"
            min="0"
            step="0.01"
            value={draft.amount}
            onChange={(event) => patch({ amount: event.target.value })}
          />
        </Field>

        {draft.section === "lodging" ? (
          <>
            <Field
              id="receipt-check-in"
              label="Check-in"
              required
              error={errors.check_in}
            >
              <Input
                id="receipt-check-in"
                type="date"
                value={draft.check_in ?? ""}
                onChange={(event) =>
                  patch({ check_in: event.target.value || null })
                }
              />
            </Field>
            <Field
              id="receipt-check-out"
              label="Check-out"
              required
              error={errors.check_out}
            >
              <Input
                id="receipt-check-out"
                type="date"
                value={draft.check_out ?? ""}
                onChange={(event) =>
                  patch({ check_out: event.target.value || null })
                }
              />
            </Field>
            <Field
              id="receipt-hotel"
              label="Hotel"
              required
              error={errors.hotel_name}
            >
              <Input
                id="receipt-hotel"
                value={draft.hotel_name ?? ""}
                onChange={(event) =>
                  patch({ hotel_name: event.target.value || null })
                }
              />
            </Field>
            <Field id="receipt-city" label="City" required error={errors.city}>
              <Input
                id="receipt-city"
                value={draft.city ?? ""}
                onChange={(event) =>
                  patch({ city: event.target.value || null })
                }
              />
            </Field>
          </>
        ) : null}

        {draft.section === "transport" ? (
          <>
            <Field
              id="receipt-tx-date"
              label="Date"
              required
              error={errors.expense_date}
            >
              <Input
                id="receipt-tx-date"
                type="date"
                value={draft.expense_date ?? ""}
                onChange={(event) =>
                  patch({ expense_date: event.target.value || null })
                }
              />
            </Field>
            <Field id="receipt-tx-time" label="Time">
              <Input
                id="receipt-tx-time"
                type="time"
                value={draft.expense_time ?? ""}
                onChange={(event) =>
                  patch({ expense_time: event.target.value || null })
                }
              />
            </Field>
            <Field
              id="receipt-from"
              label="From"
              required
              error={errors.from_location}
            >
              <Input
                id="receipt-from"
                value={draft.from_location ?? ""}
                onChange={(event) =>
                  patch({ from_location: event.target.value || null })
                }
              />
            </Field>
            <Field
              id="receipt-to"
              label="To"
              required
              error={errors.to_location}
            >
              <Input
                id="receipt-to"
                value={draft.to_location ?? ""}
                onChange={(event) =>
                  patch({ to_location: event.target.value || null })
                }
              />
            </Field>
            <Field id="receipt-mode" label="Mode" required error={errors.mode}>
              <Input
                id="receipt-mode"
                value={draft.mode ?? ""}
                onChange={(event) =>
                  patch({ mode: event.target.value || null })
                }
              />
            </Field>
          </>
        ) : null}

        {draft.section === "other" ? (
          <>
            <Field
              id="receipt-other-date"
              label="Date"
              required
              error={errors.expense_date}
            >
              <Input
                id="receipt-other-date"
                type="date"
                value={draft.expense_date ?? ""}
                onChange={(event) =>
                  patch({ expense_date: event.target.value || null })
                }
              />
            </Field>
            <Field id="receipt-head" label="Head" required error={errors.head}>
              <Input
                id="receipt-head"
                value={draft.head ?? ""}
                onChange={(event) =>
                  patch({ head: event.target.value || null })
                }
              />
            </Field>
            <Field id="receipt-desc" label="Description">
              <Input
                id="receipt-desc"
                value={draft.description ?? ""}
                onChange={(event) =>
                  patch({ description: event.target.value || null })
                }
              />
            </Field>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save to settlement"}
        </Button>
      </div>
    </div>
  );
}
