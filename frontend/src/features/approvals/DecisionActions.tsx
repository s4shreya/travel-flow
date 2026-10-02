import { useState } from "react";

import {
  decideApproval,
  type ApprovalDecisionInput,
  type ApprovalKind,
} from "@/api/approvals";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextArea } from "@/components/ui/Field";
import { errorMessage } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { REMARKS_MAX } from "@/lib/validation";

interface DecisionActionsProps {
  approvalId: number;
  kind: ApprovalKind;
  /** Stage being decided, e.g. "Trip approval". */
  stage: string;
  /** Amount being decided at this step. */
  amount: number;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onDone: (decision: ApprovalDecisionInput) => void;
  onError: (message: string) => void;
}

interface DialogCopy {
  title: string;
  body: string;
  confirm: string;
  /** Remarks box placeholder; no box when omitted. */
  placeholder?: string;
  required?: boolean;
}

// Confirmation copy per decision
function dialogCopy(decision: ApprovalDecisionInput, kind: ApprovalKind, stage: string, amount: number): DialogCopy {
  switch (decision) {
    case "approved":
      return {
        title: `Approve — ${stage}?`,
        // a settlement has one Finance review; trips go up the approval matrix
        body:
          kind === "settlement"
            ? `${formatRupees(amount)} is approved. The claim moves to Payments for payout or payroll recovery.`
            : `${formatRupees(amount)} is approved at this step. It moves to the next approver, or to Finance if this was the last level.`,
        confirm: `Approve ${stage.toLowerCase()}`,
      };
    case "returned":
      return {
        title: "Send back for changes?",
        body: "The employee can edit and submit again. Tell them what to fix.",
        confirm: "Send back",
        placeholder: "What should be corrected?",
        required: true,
      };
    case "rejected":
      return {
        title: "Reject this request?",
        body: "This ends the request. The employee is notified with your comments.",
        confirm: "Reject",
        placeholder: "Why is this being rejected?",
        required: true,
      };
  }
}

/** Send back / Reject / Approve for the current pending approval step; each asks to confirm. */
export function DecisionActions({
  approvalId,
  kind,
  stage,
  amount,
  busy,
  onBusy,
  onDone,
  onError,
}: DecisionActionsProps) {
  const [dialogFor, setDialogFor] = useState<ApprovalDecisionInput | null>(null);
  const [remarks, setRemarks] = useState("");

  function closeDialog() {
    setDialogFor(null);
    setRemarks("");
  }

  async function decide(decision: ApprovalDecisionInput, note?: string) {
    onBusy(true);
    onError("");
    try {
      await decideApproval(approvalId, decision, note?.trim() || undefined, kind);
      closeDialog();
      onDone(decision);
    } catch (err) {
      onError(errorMessage(err, "Decision failed"));
    } finally {
      onBusy(false);
    }
  }

  const dialog = dialogFor ? dialogCopy(dialogFor, kind, stage, amount) : null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={busy} onClick={() => setDialogFor("returned")}>
        Send back
      </Button>
      <Button variant="danger" disabled={busy} onClick={() => setDialogFor("rejected")}>
        Reject
      </Button>
      <Button disabled={busy} onClick={() => setDialogFor("approved")}>
        Approve · {stage}
      </Button>

      {dialogFor && dialog ? (
        <ConfirmDialog
          title={dialog.title}
          body={dialog.body}
          confirmLabel={busy ? "Saving…" : dialog.confirm}
          cancelLabel="Not yet"
          confirmVariant={dialogFor === "rejected" ? "danger" : "primary"}
          // Comments are mandatory when sending back or rejecting
          confirmDisabled={busy || (!!dialog.required && !remarks.trim())}
          onCancel={closeDialog}
          onConfirm={() => void decide(dialogFor, remarks)}
        >
          {dialog.placeholder ? (
            <TextArea
              aria-label="Comments"
              maxLength={REMARKS_MAX}
              value={remarks}
              placeholder={dialog.placeholder}
              onChange={(event) => setRemarks(event.target.value)}
            />
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
