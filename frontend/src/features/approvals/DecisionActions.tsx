import { useState } from "react";

import { decideApproval } from "@/api/approvals";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";

interface DecisionActionsProps {
  employeeCode: string;
  approvalId: number;
  kind: "travel_request" | "settlement";
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onDone: (decision: "approved" | "returned" | "rejected") => void;
  onError: (message: string) => void;
}

/** Approve / Return / Reject for the current pending approval step. */
export function DecisionActions({
  employeeCode,
  approvalId,
  kind,
  busy,
  onBusy,
  onDone,
  onError,
}: DecisionActionsProps) {
  const [returnOpen, setReturnOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState<string | null>(null);

  async function decide(
    decision: "approved" | "returned" | "rejected",
    note?: string,
  ) {
    if (decision === "returned" && !remarks.trim()) {
      setRemarksError("Remarks are required when returning");
      return;
    }
    onBusy(true);
    onError("");
    setRemarksError(null);
    try {
      await decideApproval(employeeCode, approvalId, decision, note, kind);
      setReturnOpen(false);
      setRemarks("");
      onDone(decision);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="">

      {returnOpen ? (
        <div className="mt-3">
          
          <div className="mt-3">
            <Field
              id="return-remarks"
              label="Remarks"
              required
              error={remarksError ?? undefined}
            >
              <TextArea
                id="return-remarks"
                value={remarks}
                placeholder="What should be corrected?"
                onChange={(event) => {
                  setRemarksError(null);
                  setRemarks(event.target.value);
                }}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              disabled={busy}
              onClick={() => void decide("returned", remarks)}
            >
              Confirm return
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setReturnOpen(false);
                setRemarks("");
                setRemarksError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button disabled={busy} onClick={() => void decide("approved")}>
            Approve
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setReturnOpen(true)}
          >
            Return
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void decide("rejected")}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

/** First pending step assigned to this employee (sequential chain). */
export function currentPendingForEmployee<
  T extends { decision: string; approver_id: number | null },
>(approvals: T[], employeeId: number): T | null {
  const pending = approvals.find((step) => step.decision === "pending");
  if (!pending || pending.approver_id !== employeeId) return null;
  return pending;
}
