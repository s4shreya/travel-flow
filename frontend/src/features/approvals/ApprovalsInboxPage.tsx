import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  decideApproval,
  fetchApprovalInbox,
  type ApprovalInboxItem,
} from "@/api/approvals";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { useEmployee } from "@/context/EmployeeContext";
import { formatAmountValue } from "@/lib/money";

export function ApprovalsInboxPage() {
  const { employeeCode, can } = useEmployee();
  const [rows, setRows] = useState<ApprovalInboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [returnFor, setReturnFor] = useState<ApprovalInboxItem | null>(null);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchApprovalInbox(employeeCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [employeeCode]);

  useEffect(() => {
    if (!can("approve_requests")) {
      setLoading(false);
      return;
    }
    void load();
  }, [can, load]);

  async function onDecide(
    row: ApprovalInboxItem,
    decision: "approved" | "returned" | "rejected",
    note?: string
  ) {
    setBusyId(row.approval_id);
    setError(null);
    try {
      await decideApproval(
        employeeCode,
        row.approval_id,
        decision,
        note,
        row.kind
      );
      setReturnFor(null);
      setRemarks("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!can("approve_requests")) {
    return <Alert tone="error">You do not have access to approvals.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
          Approvals
        </p>
        <h1 className="font-display mt-2 text-3xl text-teal-950">Inbox</h1>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-slate-600">No pending approvals.</p>
      ) : null}

      {returnFor ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">
            Return {returnFor.travel_request_id} with remarks
          </p>
          <TextArea
            className="mt-3"
            value={remarks}
            placeholder="What should the employee fix?"
            onChange={(event) => setRemarks(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={busyId === returnFor.approval_id || !remarks.trim()}
              onClick={() => void onDecide(returnFor, "returned", remarks)}
            >
              Confirm return
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setReturnFor(null);
                setRemarks("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={`${row.kind}-${row.approval_id}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  to={`/travel-requests/${row.travel_request_id}`}
                  className="font-semibold text-teal-900 hover:underline"
                >
                  {row.travel_request_id}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  {row.destination} · Level {row.level} ({row.role_required}) ·{" "}
                  {row.kind === "settlement" ? "Settlement" : "Travel request"}{" "}
                  · ₹{formatAmountValue(row.amount)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={busyId === row.approval_id}
                onClick={() => void onDecide(row, "approved")}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                disabled={busyId === row.approval_id}
                onClick={() => {
                  setReturnFor(row);
                  setRemarks("");
                }}
              >
                Return
              </Button>
              <Button
                variant="ghost"
                disabled={busyId === row.approval_id}
                onClick={() => void onDecide(row, "rejected")}
              >
                Reject
              </Button>
              <Link
                to={`/travel-requests/${row.travel_request_id}`}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                View travel request
              </Link>
              {row.kind === "settlement" ? (
                <Link
                  to={`/travel-requests/${row.travel_request_id}/settlement`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  View settlement
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
