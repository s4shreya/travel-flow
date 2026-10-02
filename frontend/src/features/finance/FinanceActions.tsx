import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, TextArea } from "@/components/ui/Field";
import {
  FINANCE_TASK,
  rejectFinanceTask,
  releaseFunds,
  type FinanceTask,
} from "@/features/finance/financeTasks";
import { errorMessage } from "@/lib/errors";
import { formatMoneyInput, formatRupees, parseMoney } from "@/lib/money";
import { REMARKS_MAX, REMARKS_MIN } from "@/lib/validation";

interface FinanceActionsProps {
  travelRequestId: string;
  task: FinanceTask;
  onDone: (toast: { title: string; body: string }) => void;
  onError: (message: string) => void;
}

type ReleaseMode = "full" | "partial";

/** Advance check: positive, at most what is still owed. */
function partialError(raw: string, max: number): string | null {
  const amount = parseMoney(raw);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount above ₹0";
  if (amount > max) return `Cannot exceed ${formatRupees(max)}`;
  return null;
}

/** Decline / send back + release for the Finance task on this trip; each asks to confirm. */
export function FinanceActions({ travelRequestId, task, onDone, onError }: FinanceActionsProps) {
  const copy = FINANCE_TASK[task.kind];
  const isAdvance = task.kind === "advance";
  const [dialog, setDialog] = useState<"release" | "reject" | null>(null);
  const [mode, setMode] = useState<ReleaseMode>("full");
  const [partial, setPartial] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  // Amount being released now (advance can be partial)
  const amountError = isAdvance && mode === "partial" ? partialError(partial, task.amount) : null;
  const amount = isAdvance && mode === "partial" ? parseMoney(partial) : task.amount;

  function close() {
    setDialog(null);
    setMode("full");
    setPartial("");
    setRemarks("");
  }

  /** Run the API call, then hand the toast (built from its result) to the page. */
  async function run<T>(action: () => Promise<T>, toast: (result: T) => { title: string; body: string }) {
    setBusy(true);
    onError("");
    try {
      const result = await action();
      close();
      onDone(toast(result));
    } catch (err) {
      onError(errorMessage(err, "Finance action failed"));
      setBusy(false);
    }
  }

  function onRelease() {
    const left = task.amount - amount;
    void run(
      () => releaseFunds(travelRequestId, task, amount),
      (reference) => {
        // payment reference generated for the advance transfer
        const ref = reference ? ` · Ref ${reference}` : "";
        // a partial advance stays in the queue for the rest
        return left > 0
          ? { title: "Partial advance released", body: `${formatRupees(amount)} released · ${formatRupees(left)} still pending${ref}` }
          : { title: copy.done, body: `${travelRequestId} · ${formatRupees(amount)}${ref}` };
      },
    );
  }

  function onReject() {
    void run(
      () => rejectFinanceTask(travelRequestId, task, remarks.trim()),
      () => ({ title: copy.rejected, body: `${travelRequestId} · the employee has been notified` }),
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={isAdvance ? "danger" : "secondary"} disabled={busy} onClick={() => setDialog("reject")}>
        {copy.reject}
      </Button>
      <Button disabled={busy} onClick={() => setDialog("release")}>
        {copy.action} · {formatRupees(task.amount)}
      </Button>

      {/* release: full or partial advance; settlement payout is a plain confirm */}
      {dialog === "release" ? (
        <ConfirmDialog
          title={copy.confirmTitle}
          body={
            <>
              <strong>{Number.isFinite(amount) && amount > 0 ? formatRupees(amount) : "The amount"}</strong>{" "}
              {copy.outcome}
            </>
          }
          confirmLabel={busy ? "Saving…" : isAdvance ? `Release ${formatRupees(Number.isFinite(amount) ? amount : 0)}` : copy.action}
          cancelLabel="Not yet"
          confirmDisabled={busy || !!amountError}
          onCancel={close}
          onConfirm={onRelease}
        >
          {isAdvance ? (
            <div className="flex flex-col gap-4">
              <ChoiceCards<ReleaseMode>
                name="release-mode"
                label="Amount to release"
                value={mode}
                onChange={setMode}
                choices={[
                  { value: "full", label: "Full amount", hint: formatRupees(task.amount) },
                  { value: "partial", label: "Partial amount", hint: "Choose how much" },
                ]}
              />
              {mode === "partial" ? (
                <Field id="release-amount" label="Amount (₹)" required error={partial ? amountError ?? undefined : undefined} hint={`Up to ${formatRupees(task.amount)}; the rest stays pending`}>
                  <Input
                    id="release-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={partial}
                    placeholder="0"
                    onChange={(event) => setPartial(formatMoneyInput(event.target.value))}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </ConfirmDialog>
      ) : null}

      {/* decline advance / send settlement back: reason is mandatory */}
      {dialog === "reject" ? (
        <ConfirmDialog
          title={copy.rejectTitle}
          body={copy.rejectBody}
          confirmLabel={busy ? "Saving…" : copy.reject}
          cancelLabel="Not yet"
          confirmVariant={isAdvance ? "danger" : "primary"}
          confirmDisabled={busy || remarks.trim().length < REMARKS_MIN}
          onCancel={close}
          onConfirm={onReject}
        >
          <TextArea
            aria-label="Reason"
            value={remarks}
            maxLength={REMARKS_MAX}
            placeholder={isAdvance ? "Why is the advance declined?" : "What should the employee correct?"}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
