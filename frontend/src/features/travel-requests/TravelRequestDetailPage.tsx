import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getTravelRequest, releaseAdvance } from "@/api/travelRequests";
import {
  confirmReceipt,
  listReceipts,
  uploadReceipt,
  type Receipt,
  type ReceiptExpensePayload,
} from "@/api/receipts";
import {
  getSettlement,
  markSettlementPaid,
  type Settlement,
} from "@/api/settlements";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useEmployee } from "@/context/EmployeeContext";
import {
  currentPendingForEmployee,
  DecisionActions,
} from "@/features/approvals/DecisionActions";
import { ReceiptExpenseForm } from "@/features/travel-requests/ReceiptExpenseForm";
import { TravelRequestFormView } from "@/features/travel-requests/TravelRequestFormView";
import { formatAmountValue } from "@/lib/money";
import {
  formatDecision,
  formatRequestStatus,
  formatSettlementStatus,
} from "@/lib/statusLabels";
import type { TravelRequest } from "@/types/travelRequest";

export function TravelRequestDetailPage() {
  const { travelRequestId = "" } = useParams();
  const { employeeCode, employee, can } = useEmployee();
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<{
    title: string;
    body: string;
  } | null>(null);

  const isOwner = request && employee && request.employee_id === employee.id;
  const isDraft = request?.status === "draft";
  const isApprovedLike =
    request?.status === "approved" || request?.status === "in_settlement";

  const reload = useCallback(async () => {
    const trip = await getTravelRequest(employeeCode, travelRequestId);
    setRequest(trip);
    if (trip.status === "approved" || trip.status === "in_settlement") {
      const [receiptRows, settlementRow] = await Promise.all([
        listReceipts(employeeCode, travelRequestId),
        getSettlement(employeeCode, travelRequestId),
      ]);
      setReceipts(receiptRows);
      setSettlement(settlementRow);
    } else {
      setReceipts([]);
      setSettlement(null);
    }
  }, [employeeCode, travelRequestId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load request");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const row = await uploadReceipt(employeeCode, travelRequestId, file);
      setReceipts((prev) => [row, ...prev]);
      setActiveReceipt(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSaveExpense(payload: ReceiptExpensePayload) {
    if (!activeReceipt) return;
    setSaving(true);
    setError(null);
    setReceiptError(null);
    setMessage(null);
    try {
      const updated = await confirmReceipt(
        employeeCode,
        travelRequestId,
        activeReceipt.id,
        payload,
      );
      setSettlement(updated);
      setActiveReceipt(null);
      setMessage(
        "Expense saved to the settlement draft. Open the settlement form to review.",
      );
    } catch (err) {
      setReceiptError(
        err instanceof Error ? err.message : "Could not save expense line",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onReleaseAdvance() {
    if (!request) return;
    const remaining =
      Number(request.advance_requested) - Number(request.advance_disbursed);
    if (remaining <= 0) return;
    setActionBusy(true);
    setError(null);
    setMessage(null);
    try {
      await releaseAdvance(
        employeeCode,
        travelRequestId,
        remaining.toFixed(2),
        `ADV/${travelRequestId}`,
      );
      await reload();
      setActionSuccess({
        title: "Advance released",
        body: `Advance for ${travelRequestId} is released.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Advance release failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function onSettlementPayment() {
    setActionBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await markSettlementPaid(employeeCode, travelRequestId);
      setSettlement(result);
      await reload();
      const recovery =
        Number(result.amount_recoverable) > 0 &&
        Number(result.amount_payable) <= 0;
      setActionSuccess({
        title: recovery ? "Payroll recovery noted" : "Settlement funds released",
        body: recovery
          ? `Excess advance for ${travelRequestId} will be recovered in the next payroll.`
          : `Settlement payment for ${travelRequestId} is complete.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment update failed");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error && !request) {
    return <Alert tone="error">{error}</Alert>;
  }

  if (!request) return null;

  // After approve / release — hide form, show success only
  if (actionSuccess) {
    return (
      <div className="flex flex-col gap-6 animate-in">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
            Travel request
          </p>
          <h1 className="font-display mt-2 text-3xl text-teal-950">
            {request.travel_request_id}
          </h1>
        </div>

        <Alert tone="success" title={actionSuccess.title}>
          <p>{actionSuccess.body}</p>
          <p className="mt-2 text-sm">
            Status: <strong>{formatRequestStatus(request.status)}</strong>
            {settlement
              ? ` · Advance Released`
              : null}
          </p>
        </Alert>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            Home
          </Link>
          {can("approve_requests") ? (
            <Link
              to="/approvals"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Approvals inbox
            </Link>
          ) : null}
          {can("release_funds") ? (
            <Link
              to="/finance"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Finance queue
            </Link>
          ) : null}
          <Link
            to="/travel-requests"
            className="inline-flex items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-900"
          >
            Track requests
          </Link>
        </div>
      </div>
    );
  }

  const returnedRemarks = request.approvals.filter(
    (step) => step.decision === "returned" && step.remarks,
  );

  const requestPending =
    employee != null
      ? currentPendingForEmployee(request.approvals, employee.id)
      : null;
  const settlementPending =
    employee != null && settlement
      ? currentPendingForEmployee(settlement.approvals, employee.id)
      : null;

  const advanceRemaining =
    Number(request.advance_requested) - Number(request.advance_disbursed);
  const canReleaseAdvance =
    can("release_funds") &&
    request.status === "approved" &&
    advanceRemaining > 0;
  const canReleaseSettlement =
    can("release_funds") &&
    settlement != null &&
    (settlement.status === "queued_for_payment" ||
      settlement.status === "recoverable");

  return (
    <div className="flex flex-col gap-6 animate-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
            Travel request
          </p>
          <h1 className="font-display mt-2 text-3xl text-teal-950">
            {request.travel_request_id}
          </h1>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900">
          {formatRequestStatus(request.status)}
        </span>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="info">{message}</Alert> : null}

      {returnedRemarks.length > 0 ? (
        <Alert tone="info" title="Returned with remarks">
          <ul className="list-disc pl-5">
            {returnedRemarks.map((step) => (
              <li key={step.id}>
                Level {step.level} ({step.role_required}): {step.remarks}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <TravelRequestFormView request={request} />

      {requestPending ? (
        <DecisionActions
          employeeCode={employeeCode}
          approvalId={requestPending.id}
          kind="travel_request"
          busy={actionBusy}
          onBusy={setActionBusy}
          onError={(msg) => setError(msg || null)}
          onDone={(decision) => {
            void (async () => {
              await reload();
              const copy =
                decision === "approved"
                  ? {
                      title: "Request approved",
                      body: `${travelRequestId} has been approved and will move to the next step.`,
                    }
                  : decision === "returned"
                    ? {
                        title: "Request returned",
                        body: `${travelRequestId} has been returned to the employee for correction.`,
                      }
                    : {
                        title: "Request rejected",
                        body: `${travelRequestId} has been rejected.`,
                      };
              setActionSuccess(copy);
            })();
          }}
        />
      ) : null}

      {settlementPending ? (
        <DecisionActions
          employeeCode={employeeCode}
          approvalId={settlementPending.id}
          kind="settlement"
          busy={actionBusy}
          onBusy={setActionBusy}
          onError={(msg) => setError(msg || null)}
          onDone={(decision) => {
            void (async () => {
              await reload();
              const copy =
                decision === "approved"
                  ? {
                      title: "Settlement approved",
                      body: `The settlement for ${travelRequestId} has been approved and will move to the next step.`,
                    }
                  : decision === "returned"
                    ? {
                        title: "Settlement returned",
                        body: `The settlement for ${travelRequestId} has been returned to the employee for correction.`,
                      }
                    : {
                        title: "Settlement rejected",
                        body: `The settlement for ${travelRequestId} has been rejected.`,
                      };
              setActionSuccess(copy);
            })();
          }}
        />
      ) : null}

      {canReleaseAdvance || canReleaseSettlement ? (
        <div className="">
          <div className="flex flex-wrap justify-end ">
            {canReleaseAdvance ? (
              <Button
                disabled={actionBusy}
                onClick={() => void onReleaseAdvance()}
              >
                Release Advance Funds (₹
                {formatAmountValue(advanceRemaining)})
              </Button>
            ) : null}
            {canReleaseSettlement && settlement ? (
              <>
                <Button
                  disabled={actionBusy}
                  onClick={() => void onSettlementPayment()}
                >
                  {settlement.status === "recoverable" ||
                  Number(settlement.amount_recoverable) > 0
                    ? "Note payroll recovery"
                    : "Release settlement funds"}
                </Button>
                <Link
                  to={`/travel-requests/${travelRequestId}/settlement`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Open settlement form
                </Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {request.approvals.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">Approvals</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {request.approvals.map((step) => (
              <li
                key={step.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  Level {step.level}: {step.role_required}
                </span>
                <span className="font-medium text-slate-800">
                  {formatDecision(step.decision)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isOwner && isDraft ? (
        <div className="flex justify-end">
          <Link
            to={`/travel-requests/${request.travel_request_id}/edit`}
            className="inline-flex items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900"
          >
            Edit draft
          </Link>
        </div>
      ) : null}

      {isOwner && isApprovedLike ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">
            Trip workspace
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload a receipt, fill the expense fields manually, then save. Saved
            lines appear on the settlement form.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50">
              {uploading ? "Uploading…" : "Upload receipt"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                accept="image/*,.pdf,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void onUpload(file);
                  event.target.value = "";
                }}
              />
            </label>
            <Link
              to={`/travel-requests/${request.travel_request_id}/settlement`}
              className="inline-flex items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900"
            >
              {settlement ? "Open settlement form" : "Fill settlement form"}
            </Link>
          </div>

          {activeReceipt ? (
            <ReceiptExpenseForm
              key={activeReceipt.id}
              receiptId={activeReceipt.id}
              receiptName={activeReceipt.original_name}
              travelRequestId={travelRequestId}
              saving={saving}
              apiError={receiptError}
              onCancel={() => {
                setActiveReceipt(null);
                setReceiptError(null);
              }}
              onSave={(payload) => {
                void onSaveExpense(payload);
              }}
            />
          ) : null}

          <h3 className="mt-6 text-sm font-semibold text-slate-800">
            Uploaded receipts
          </h3>
          {receipts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No receipts yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {receipts.map((receipt) => (
                <li
                  key={receipt.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    {receipt.original_name}
                    <span className="ml-2 text-xs text-slate-400">
                      #{receipt.id}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setActiveReceipt(receipt)}
                  >
                    Add expense
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {settlement ? (
            <p className="mt-4 text-sm text-slate-600">
              Settlement status:{" "}
              <strong>{formatSettlementStatus(settlement.status)}</strong>
              {settlement.expenses.length > 0
                ? ` · ${settlement.expenses.length} expense(s)`
                : null}
              {Number(settlement.amount_payable) > 0
                ? ` · payable ₹${formatAmountValue(settlement.amount_payable)}`
                : null}
              {Number(settlement.amount_recoverable) > 0
                ? ` · recoverable ₹${formatAmountValue(settlement.amount_recoverable)}`
                : null}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
