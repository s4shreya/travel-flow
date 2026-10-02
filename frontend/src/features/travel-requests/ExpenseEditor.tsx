import { ScanSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  extractReceipt,
  type EvidenceStatus,
  type PolicyLevel,
  type Receipt,
  type ReceiptExtraction,
} from "@/api/receipts";
import { Alert } from "@/components/ui/Alert";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/Button";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PolicyReference } from "@/components/ui/PolicyReference";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { EXPENSE_MODE_OPTIONS } from "@/config/options";
import { SETTLEMENT_RULES } from "@/config/policy";
import { EXPENSE_SECTIONS, PAID_BY_CHOICES } from "@/features/travel-requests/expenseSections";
import {
  emptyDraft,
  validateExpense,
  type ExpenseDraft,
  type ExpenseErrors,
  type TripWindow,
} from "@/features/travel-requests/settlementFormModel";
import { daysBetween } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatMoneyInput, formatRupees, parseMoney } from "@/lib/money";
import { plural } from "@/lib/text";
import { tripDateBounds } from "@/lib/validation";

const FINDING_CLASS: Record<PolicyLevel, string> = {
  violation: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-slate-200 bg-white text-slate-700",
};

const FINDING_LABEL: Record<PolicyLevel, string> = {
  violation: "Policy",
  warning: "Check",
  info: "Note",
};

const CONFIDENCE_CLASS: Record<ReceiptExtraction["confidence"], string> = {
  high: "bg-teal-100 text-teal-900",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-red-100 text-red-900",
};

const EVIDENCE_LOOK: Record<EvidenceStatus, { label: string; card: string; badge: string }> = {
  matched: {
    label: "Matches the bill",
    card: "border-teal-200 bg-teal-50/40",
    badge: "border-teal-200 bg-teal-50 text-teal-800",
  },
  needs_review: {
    label: "Needs a human look",
    card: "border-amber-200 bg-amber-50/40",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
  },
  not_receipt: {
    label: "Not a valid receipt",
    card: "border-rose-200 bg-rose-50/40",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
  },
};

/** Claimed vs the bill total, with the scan's verdict on whether the file is a real bill. */
function EvidenceCard({ scan, claimedRaw }: { scan: ReceiptExtraction; claimedRaw: string }) {
  const claimed = parseMoney(claimedRaw) || 0;
  const onDocument = scan.evidence === "not_receipt" ? 0 : Number(scan.suggestion.amount ?? 0);
  const difference = claimed - onDocument;
  const mismatch = onDocument > 0 && Math.abs(difference) >= 0.01;
  // A bill whose total differs from the claim also needs a look
  const status: EvidenceStatus = scan.evidence === "matched" && mismatch ? "needs_review" : scan.evidence;
  const look = EVIDENCE_LOOK[status];
  const note =
    scan.evidence_note ??
    (mismatch
      ? "The amount claimed differs from the total on the bill — check it before saving."
      : "The amount claimed matches the total on the bill.");
  const figures: [string, string, string][] = [
    ["Claimed", formatRupees(claimed), "text-slate-900"],
    ["On the document", formatRupees(onDocument), "text-slate-900"],
    ["Difference", formatRupees(difference), mismatch || scan.evidence !== "matched" ? "text-amber-700" : "text-teal-700"],
  ];
  return (
    <section aria-label="Evidence check" className={`rounded-xl border p-4 ${look.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <ScanSearch className="h-4 w-4" aria-hidden />
          Evidence check
        </p>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${look.badge}`}>● {look.label}</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {figures.map(([label, value, tone]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className={`font-mono text-base font-semibold tabular-nums ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{note}</p>
    </section>
  );
}

/** Turn the OCR suggestion into an editable draft linked to the scanned receipt. */
function draftFromScan(scan: ReceiptExtraction, proofRef: string): ExpenseDraft {
  const s = scan.suggestion;
  const disallowed = Number(s.disallowed_amount) || 0;
  return {
    ...emptyDraft(),
    ...s,
    amount: formatMoneyInput(s.amount ?? ""),
    expense_time: s.expense_time ? s.expense_time.slice(0, 5) : null,
    disallowed_amount: disallowed > 0 ? formatMoneyInput(s.disallowed_amount) : "",
    disallow_reason: disallowed > 0 ? s.disallow_reason : null,
    proof_ref: proofRef,
  };
}

interface ExpenseEditorProps {
  travelRequestId: string;
  /** Line being edited; omit to add a new one. */
  initial?: ExpenseDraft;
  /** Just-uploaded receipt: scan it and pre-fill the form. */
  scanReceipt?: Receipt;
  /** Receipts this line may link to (not used by another line). */
  receipts: Receipt[];
  /** Trip dates — expense dates must fall inside (± one travel day). */
  trip: TripWindow;
  saving: boolean;
  apiError: string | null;
  onCancel: () => void;
  onSave: (draft: ExpenseDraft) => void;
}

/** Add / edit one settlement expense in a modal; a new receipt is scanned to pre-fill it. */
export function ExpenseEditor({
  travelRequestId,
  initial,
  scanReceipt,
  receipts,
  trip,
  saving,
  apiError,
  onCancel,
  onSave,
}: ExpenseEditorProps) {
  const [draft, setDraft] = useState<ExpenseDraft>(
    () => initial ?? { ...emptyDraft(), proof_ref: scanReceipt ? String(scanReceipt.id) : null },
  );
  const [errors, setErrors] = useState<ExpenseErrors>({});
  const [scanning, setScanning] = useState(Boolean(scanReceipt));
  const [scan, setScan] = useState<ReceiptExtraction | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  // Set when the user skips the scan, so a late result can't overwrite their typing
  const skipped = useRef(false);

  // Scan the receipt once and pre-fill the form for review
  const scanId = scanReceipt?.id;
  useEffect(() => {
    if (scanId == null) return;
    let cancelled = false;
    // Abort if the editor closes (also drops React's dev double-run), so OCR runs once
    const controller = new AbortController();
    extractReceipt(travelRequestId, scanId, controller.signal)
      .then((result) => {
        if (cancelled || skipped.current) return;
        setScan(result);
        // Don't pre-fill from a file that isn't a bill
        if (result.evidence !== "not_receipt") setDraft(draftFromScan(result, String(scanId)));
      })
      .catch((err: unknown) => {
        if (cancelled || skipped.current) return;
        setScanError(errorMessage(err, "Could not read this receipt"));
      })
      .finally(() => {
        if (!cancelled) setScanning(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [travelRequestId, scanId]);

  function patch(partial: Partial<ExpenseDraft>) {
    setErrors({});
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function handleSave() {
    const nextErrors = validateExpense(draft, trip);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSave(draft);
  }

  // Calendars only offer days inside the trip (± one travel day)
  const dateBounds = tripDateBounds(trip);
  // "5 nights" once both stay dates are picked
  const stayLength =
    draft.check_in && draft.check_out && draft.check_out >= draft.check_in
      ? plural(daysBetween(draft.check_in, draft.check_out), "night")
      : undefined;

  const title = initial ? "Edit expense" : scanReceipt ? "Review scanned bill" : "Add expense";
  const receiptOptions = [
    { value: "", label: "No receipt yet" },
    ...receipts.map((r) => ({ value: String(r.id), label: `${r.original_name} (#${r.id})` })),
  ];

  // Scanning: short wait state with a way out
  if (scanning) {
    return (
      <Modal title={title} onClose={onCancel} size="lg">
        <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50/40 p-4">
          <Loader />
          <div className="flex-1">
            <p className="text-sm font-semibold text-teal-950">Scanning receipt…</p>
            <p className="text-xs text-slate-600">
              Reading {scanReceipt?.original_name} and checking it against the travel policy.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              skipped.current = true;
              setScanning(false);
            }}
          >
            Fill manually
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add to settlement"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Is the file a real bill, and does the claim match it? */}
        {scan ? <EvidenceCard scan={scan} claimedRaw={draft.amount} /> : null}

        {/* Scan result: confidence, policy findings, rules */}
        {scan && scan.evidence !== "not_receipt" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                Pre-filled from the scan — check against the bill before saving.
              </p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[scan.confidence]}`}>
                {scan.confidence} confidence
              </span>
            </div>
            {/* Policy findings from the scan */}
            {scan.findings.length > 0 ? (
              <ul className="space-y-1.5" aria-label="Policy check">
                {scan.findings.map((finding, index) => (
                  <li
                    key={`${finding.code}-${index}`}
                    className={`rounded-md border px-3 py-2 text-xs ${FINDING_CLASS[finding.level]}`}
                  >
                    <span className="mr-1.5 font-semibold uppercase tracking-wide">
                      {FINDING_LABEL[finding.level]}
                    </span>
                    {finding.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {/* Policy behind the findings */}
            <PolicyReference rules={SETTLEMENT_RULES} />
          </div>
        ) : null}

        {scanError ? (
          <Alert tone="info" title="Couldn't scan this receipt">
            {scanError} Fill in the details below.
          </Alert>
        ) : null}
        {apiError ? (
          <Alert tone="error" title="Could not save expense">
            {apiError}
          </Alert>
        ) : null}

        {/* What kind of expense, and who paid */}
        <ChoiceCards
          name="expense-section"
          label="Expense type"
          value={draft.section}
          choices={EXPENSE_SECTIONS}
          onChange={(section) => patch({ section })}
        />
        <ChoiceCards
          name="expense-paid-by"
          label="Paid by"
          value={draft.paid_by}
          choices={PAID_BY_CHOICES}
          onChange={(paid_by) => patch({ paid_by })}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="expense-amount" label="Amount (₹)" required error={errors.amount}>
            <Input
              id="expense-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={draft.amount}
              onChange={(event) => patch({ amount: formatMoneyInput(event.target.value) })}
            />
          </Field>
          <Field id="expense-receipt" label="Receipt" hint="Needed before you submit">
            <SelectMenu
              id="expense-receipt"
              value={draft.proof_ref ?? ""}
              options={receiptOptions}
              onChange={(value) => patch({ proof_ref: value || null })}
            />
          </Field>

          {draft.section === "lodging" ? (
            <>
              <Field id="expense-check-in" label="Check-in" required error={errors.check_in}>
                <DatePicker
                  id="expense-check-in"
                  value={draft.check_in ?? ""}
                  min={dateBounds.min}
                  max={draft.check_out || dateBounds.max}
                  placeholder="Select check-in"
                  onChange={(value) => patch({ check_in: value || null })}
                />
              </Field>
              <Field
                id="expense-check-out"
                label="Check-out"
                required
                hint={stayLength}
                error={errors.check_out}
              >
                <DatePicker
                  id="expense-check-out"
                  value={draft.check_out ?? ""}
                  min={draft.check_in || dateBounds.min}
                  max={dateBounds.max}
                  placeholder="Select check-out"
                  onChange={(value) => patch({ check_out: value || null })}
                />
              </Field>
              <Field id="expense-hotel" label="Hotel" required error={errors.hotel_name}>
                <Input
                  id="expense-hotel"
                  value={draft.hotel_name ?? ""}
                  onChange={(event) => patch({ hotel_name: event.target.value || null })}
                />
              </Field>
              <Field id="expense-city" label="City" required error={errors.city}>
                <Input
                  id="expense-city"
                  value={draft.city ?? ""}
                  onChange={(event) => patch({ city: event.target.value || null })}
                />
              </Field>
            </>
          ) : null}

          {draft.section === "transport" ? (
            <>
              <Field id="expense-tx-date" label="Date" required error={errors.expense_date}>
                <DatePicker
                  id="expense-tx-date"
                  value={draft.expense_date ?? ""}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={(value) => patch({ expense_date: value || null })}
                />
              </Field>
              <Field id="expense-tx-time" label="Time">
                <Input
                  id="expense-tx-time"
                  type="time"
                  value={draft.expense_time ?? ""}
                  onChange={(event) => patch({ expense_time: event.target.value || null })}
                />
              </Field>
              <Field id="expense-from" label="From" required error={errors.from_location}>
                <Input
                  id="expense-from"
                  value={draft.from_location ?? ""}
                  onChange={(event) => patch({ from_location: event.target.value || null })}
                />
              </Field>
              <Field id="expense-to" label="To" required error={errors.to_location}>
                <Input
                  id="expense-to"
                  value={draft.to_location ?? ""}
                  onChange={(event) => patch({ to_location: event.target.value || null })}
                />
              </Field>
              <Field id="expense-mode" label="Mode" required error={errors.mode}>
                <SelectMenu
                  id="expense-mode"
                  value={draft.mode ?? ""}
                  options={EXPENSE_MODE_OPTIONS}
                  onChange={(value) => patch({ mode: value || null })}
                />
              </Field>
            </>
          ) : null}

          {draft.section === "other" ? (
            <>
              <Field id="expense-other-date" label="Date" required error={errors.expense_date}>
                <DatePicker
                  id="expense-other-date"
                  value={draft.expense_date ?? ""}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={(value) => patch({ expense_date: value || null })}
                />
              </Field>
              <Field id="expense-head" label="Head" required error={errors.head}>
                <Input
                  id="expense-head"
                  placeholder="e.g. Meals, Visa"
                  value={draft.head ?? ""}
                  onChange={(event) => patch({ head: event.target.value || null })}
                />
              </Field>
              <Field id="expense-desc" label="Description" error={errors.description}>
                <Input
                  id="expense-desc"
                  value={draft.description ?? ""}
                  onChange={(event) => patch({ description: event.target.value || null })}
                />
              </Field>
            </>
          ) : null}
        </div>

        {/* Non-reimbursable part of the bill (policy §3–§4) */}
        {draft.paid_by === "Employee" ? (
          <details
            className="rounded-lg border border-slate-200 px-3 py-2"
            open={Boolean(draft.disallowed_amount) || Boolean(errors.disallowed_amount || errors.disallow_reason)}
          >
            <summary className="cursor-pointer text-sm text-slate-700">Part of this bill isn't claimable</summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="expense-disallowed" label="Disallowed (₹)" error={errors.disallowed_amount}>
                <Input
                  id="expense-disallowed"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={draft.disallowed_amount ?? ""}
                  onChange={(event) => patch({ disallowed_amount: formatMoneyInput(event.target.value) })}
                />
              </Field>
              <Field id="expense-disallow-reason" label="Reason" error={errors.disallow_reason}>
                <Input
                  id="expense-disallow-reason"
                  maxLength={255}
                  placeholder="e.g. Mini bar, above lodging limit"
                  value={draft.disallow_reason ?? ""}
                  onChange={(event) => patch({ disallow_reason: event.target.value || null })}
                />
              </Field>
            </div>
          </details>
        ) : null}
      </div>
    </Modal>
  );
}
