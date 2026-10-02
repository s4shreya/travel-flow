import { CheckCircle2, Circle, Eye, FileText, ImageIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { deleteReceipt, listReceipts, uploadReceipt, type Receipt } from "@/api/receipts";
import { saveSettlement, type Settlement, type SettlementExpense } from "@/api/settlements";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { PolicyReference } from "@/components/ui/PolicyReference";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useConfirm } from "@/hooks/useConfirm";
import { SETTLEMENT_RULES } from "@/config/policy";
import { useEmployee } from "@/context/EmployeeContext";
import { useToast } from "@/context/ToastContext";
import { ExpenseEditor } from "@/features/travel-requests/ExpenseEditor";
import { EXPENSE_SECTIONS } from "@/features/travel-requests/expenseSections";
import { loadTripWithSettlement } from "@/features/travel-requests/loadTrip";
import { ReceiptViewer } from "@/features/travel-requests/ReceiptViewer";
import {
  expenseSummary,
  isDeskLine,
  needsReceipt,
  proofLabel,
  receiptIdOf,
  toDraft,
  toExpense,
  type ExpenseDraft,
} from "@/features/travel-requests/settlementFormModel";
import { TripFlow } from "@/features/travel-requests/TripSummary";
import { useWindowFileDrop } from "@/hooks/useWindowFileDrop";
import { currentPendingForEmployee, firstPendingStep } from "@/lib/approvals";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { paths } from "@/lib/routes";
import { settlementEditable, settlementOpen } from "@/lib/settlement";
import { advancePending } from "@/lib/tripProgress";
import { RECEIPT_ACCEPT, receiptFileError } from "@/lib/validation";
import type { TravelRequest } from "@/types/travelRequest";

/** Expense editor target: a line index to edit, or a new line (optionally from a scanned bill). */
interface EditorState {
  index: number | null;
  scanReceipt?: Receipt;
}


/** Claim figures from the server totals (before the first save: nothing claimed, advance only). */
function claimFigures(request: TravelRequest, settlement: Settlement | null) {
  if (settlement) {
    return {
      claimed: Number(settlement.total_employee_paid),
      company: Number(settlement.total_company_paid),
      disallowed: Number(settlement.disallowed_total),
      net: Number(settlement.net_reimbursable),
      advance: Number(settlement.advance_applied),
      payable: Number(settlement.amount_payable),
      recoverable: Number(settlement.amount_recoverable),
    };
  }
  const advance = Number(request.advance_disbursed) || 0;
  return { claimed: 0, company: 0, disallowed: 0, net: 0, advance, payable: 0, recoverable: advance };
}

/** Browse for one bill (PDF / image); drops anywhere on the page are handled by the page. */
function ReceiptDropzone({
  uploading,
  dragging,
  onFile,
  onManual,
}: {
  uploading: boolean;
  /** A file is being dragged over the window. */
  dragging: boolean;
  onFile: (file: File) => void;
  onManual: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-white hover:border-teal-600/60 hover:bg-slate-50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="h-6 w-6 text-teal-700" aria-hidden />
        <span className="text-sm font-medium text-slate-900">
          {uploading ? "Uploading…" : (
            <>
              Drop the bills and receipts here or <span className="text-teal-700 underline underline-offset-2">browse</span>
            </>
          )}
        </span>
        <span className="text-xs text-slate-500">
          PDF, JPG, PNG or WEBP · up to 5 MB · we scan it and pre-fill the expense
        </span>
        <input
          type="file"
          className="sr-only"
          accept={RECEIPT_ACCEPT}
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        onClick={onManual}
        className="inline-flex items-center gap-1 self-start text-sm font-medium text-teal-700 hover:text-teal-800"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add an expense without a bill
      </button>
    </div>
  );
}

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Uploaded bill tile (icon, name, size / date); opens the viewer. */
function BillFile({ receipt, onView, compact }: { receipt: Receipt; onView: () => void; compact?: boolean }) {
  const Icon = receipt.content_type === "application/pdf" ? FileText : ImageIcon;
  return (
    <button
      type="button"
      onClick={onView}
      title="View bill"
      className={`group flex min-w-0 items-center gap-2.5 text-left ${
        compact ? "max-w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition hover:border-teal-600/60 hover:bg-teal-50/50" : "flex-1"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200 ${
          compact ? "h-7 w-7" : "h-9 w-9"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-teal-800">
          {receipt.original_name}
        </span>
        <span className="block text-xs text-slate-500">
          Receipt #{receipt.id} · {fileSize(receipt.size_bytes)} · {formatDate(receipt.created_at.slice(0, 10))}
        </span>
      </span>
      {compact ? <Eye className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-teal-700" aria-hidden /> : null}
    </button>
  );
}

/** One claimed line: what, when, who paid, attached bill, amount; edit / remove when allowed. */
function ExpenseRow({
  line,
  receipt,
  editable,
  onEdit,
  onRemove,
  onViewReceipt,
}: {
  line: SettlementExpense;
  /** The uploaded bill this line is backed by, if any. */
  receipt?: Receipt;
  editable: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onViewReceipt: () => void;
}) {
  const { detail, when } = expenseSummary(line);
  const desk = isDeskLine(line);
  const missing = needsReceipt(line);
  const linked = receiptIdOf(line) != null;
  const disallowed = Number(line.disallowed_amount ?? 0);
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{detail || "Expense"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {when ? <span>{when}</span> : null}
          <span>{line.paid_by === "Employee" ? "Paid by you" : "Paid by company"}</span>
          {/* desk bookings / missing proof get a chip; uploaded bills show below */}
          {desk ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{proofLabel(line)}</span> : null}
          {missing ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">Receipt missing</span> : null}
        </div>
        {disallowed > 0 ? (
          <p className="mt-1 text-xs text-rose-700">
            {formatRupees(disallowed)} not claimable{line.disallow_reason ? ` · ${line.disallow_reason}` : ""}
          </p>
        ) : null}
        {/* the bill attached to this expense */}
        {receipt ? (
          <div className="mt-2 flex">
            <BillFile receipt={receipt} onView={onViewReceipt} compact />
          </div>
        ) : linked ? (
          <button
            type="button"
            onClick={onViewReceipt}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 hover:ring-1 hover:ring-teal-600"
          >
            <Eye className="h-3 w-3" aria-hidden />
            {proofLabel(line)}
          </button>
        ) : null}
      </div>
      <p className="text-sm font-semibold tabular-nums text-slate-900">{formatRupees(line.amount)}</p>
      {/* desk bookings come from the travel desk and stay read-only */}
      {editable && !desk ? (
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Edit expense"
            onClick={onEdit}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Remove expense"
            onClick={onRemove}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </li>
  );
}

/** Bills uploaded but not on any expense yet: view, turn into an expense, or delete. */
function UnclaimedBills({
  receipts,
  editable,
  onView,
  onAdd,
  onDelete,
}: {
  receipts: Receipt[];
  editable: boolean;
  onView: (receipt: Receipt) => void;
  onAdd: (receipt: Receipt) => void;
  onDelete: (receipt: Receipt) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-amber-950">
          Bills not on an expense <span className="font-normal text-amber-800">· {receipts.length}</span>
        </h2>
        <p className="text-xs text-amber-800">Add each to an expense to claim it, or delete it if it was uploaded by mistake.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {receipts.map((receipt) => (
          <li key={receipt.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <BillFile receipt={receipt} onView={() => onView(receipt)} />
            <div className="flex items-center gap-1">
              <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onView(receipt)}>
                View
              </Button>
              {editable ? (
                <>
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onAdd(receipt)}>
                    Scan &amp; add
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${receipt.original_name}`}
                    onClick={() => onDelete(receipt)}
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Label / value row in the summary card. */
function SummaryRow({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className={strong ? "font-semibold text-slate-900" : "text-slate-600"}>
        {label}
        {hint ? <span className="block text-xs font-normal text-slate-500">{hint}</span> : null}
      </dt>
      <dd className={`tabular-nums ${strong ? "text-base font-semibold text-teal-900" : "font-medium text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}

function CheckItem({ done, children }: { done: boolean; children: string }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className={`flex items-center gap-2 ${done ? "text-slate-700" : "text-slate-500"}`}>
      <Icon className={`h-4 w-4 ${done ? "text-teal-600" : "text-slate-300"}`} aria-hidden />
      {children}
    </li>
  );
}

export function SettlementPage() {
  const { travelRequestId = "" } = useParams();
  const { employee, can } = useEmployee();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null);

  // Requester can add / change expenses once the advance step is over, until the claim is submitted
  const editable = request != null && settlementEditable(request, settlement, employee?.id);

  // upload a bill, then open the editor to review the scan
  async function onFile(file: File) {
    setError(null);
    // Check type / size before sending (server re-checks the file signature)
    const fileError = receiptFileError(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setUploading(true);
    try {
      const row = await uploadReceipt(travelRequestId, file);
      setReceipts((prev) => [row, ...prev]);
      setEditor({ index: null, scanReceipt: row });
    } catch (err) {
      setError(errorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  // Drop a bill anywhere on the page (not while a dialog or upload is busy)
  const dragging = useWindowFileDrop(editable && !uploading && !editor && !viewing, (file) => void onFile(file));

  // Load the trip, its settlement and uploaded receipts
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadTripWithSettlement(travelRequestId),
      listReceipts(travelRequestId),
    ])
      .then(([{ trip, settlement: row }, receiptRows]) => {
        if (cancelled) return;
        setRequest(trip);
        setSettlement(row);
        setReceipts(receiptRows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load settlement"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [travelRequestId]);

  if (loading) return <PageLoader />;
  if (!request) return <Alert tone="error">{error ?? "Settlement not found"}</Alert>;

  // The Finance Controller decides from the Approvals review page, not the claim form
  if (settlement && employee && currentPendingForEmployee(settlement.approvals, employee.id)) {
    return <Navigate to={paths.review(travelRequestId)} replace />;
  }

  const trip = request;
  const isOwner = employee?.id === trip.employee_id;
  const tripOpen = settlementOpen(trip);
  const waitingOnAdvance = advancePending(trip) && trip.status === "approved";
  const expenses = settlement?.expenses ?? [];
  // API-ready copy of the saved lines (drops read-only fields like id / nights)
  const lines = expenses.map((line) => toExpense(toDraft(line)));
  const missingReceipts = expenses.filter(needsReceipt).length;
  const figures = claimFigures(trip, settlement);
  const receiptsById = new Map(receipts.map((row) => [String(row.id), row]));
  const tripWindow = { start_date: trip.start_date, end_date: trip.end_date };
  // Sent back by Finance: remarks stay until the claim is resubmitted
  const returnedRemarks = editable
    ? (settlement?.approvals ?? []).filter((step) => step.decision === "returned" && step.remarks)
    : [];

  /** Save the full line list as a draft; returns the saved settlement or throws. */
  async function persist(next: SettlementExpense[], submit = false) {
    const result = await saveSettlement(travelRequestId, { expenses: next, submit });
    setSettlement(result);
    return result;
  }

  function closeEditor() {
    setEditor(null);
    setEditorError(null);
  }

  // add or replace one line, autosaved as a draft
  async function onSaveExpense(draft: ExpenseDraft) {
    if (!editor) return;
    const line = toExpense(draft);
    const isNew = editor.index === null;
    const next = isNew ? [...lines, line] : lines.map((row, i) => (i === editor.index ? line : row));
    setSaving(true);
    setEditorError(null);
    try {
      await persist(next);
      closeEditor();
      toast(isNew ? "Expense added" : "Expense updated", `${formatRupees(line.amount)} · ${expenseSummary(line).detail || line.section}`);
    } catch (err) {
      setEditorError(errorMessage(err, "Could not save expense"));
    } finally {
      setSaving(false);
    }
  }

  /** Delete an uploaded bill and drop it from the list. */
  async function removeBill(receiptId: string) {
    await deleteReceipt(travelRequestId, receiptId);
    setReceipts((prev) => prev.filter((row) => String(row.id) !== receiptId));
  }

  // remove the line, then its bill (the bill can't be deleted while a line uses it)
  async function onRemove(index: number) {
    const line = expenses[index];
    const receiptId = receiptIdOf(line);
    const bill = receiptId ? receiptsById.get(receiptId) : undefined;
    const ok = await confirm({
      title: "Remove this expense?",
      body: `${expenseSummary(line).detail || "This line"} · ${formatRupees(line.amount)} will be taken off the claim.${
        receiptId ? ` Its bill${bill ? ` (${bill.original_name})` : ""} will be deleted too.` : ""
      }`,
      confirmLabel: "Remove",
      cancelLabel: "Keep",
    });
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      await persist(lines.filter((_, i) => i !== index));
      if (receiptId) {
        try {
          await removeBill(receiptId);
        } catch (err) {
          // the expense is gone; the bill stays under "Bills not on an expense"
          setError(errorMessage(err, "Expense removed, but the bill could not be deleted"));
        }
      }
      toast("Expense removed", `${formatRupees(line.amount)} taken off the claim${receiptId ? " · bill deleted" : ""}`);
    } catch (err) {
      setError(errorMessage(err, "Could not remove expense"));
    } finally {
      setSaving(false);
    }
  }

  // delete a bill that isn't on any expense
  async function onDeleteBill(receipt: Receipt) {
    const ok = await confirm({
      title: "Delete this bill?",
      body: `${receipt.original_name} will be permanently deleted.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      await removeBill(String(receipt.id));
      toast("Bill deleted", receipt.original_name);
    } catch (err) {
      setError(errorMessage(err, "Could not delete bill"));
    } finally {
      setSaving(false);
    }
  }

  // Submitting locks the claim — confirm first
  async function onSubmit() {
    const outcome =
      figures.recoverable > 0
        ? `${formatRupees(figures.recoverable)} of your advance will be recovered.`
        : `${formatRupees(figures.payable)} will be paid to you once Finance approves it.`;
    const ok = await confirm({
      title: "Submit settlement for Finance review?",
      body: `You are claiming ${formatRupees(figures.net)}. ${outcome} You can't edit the claim unless it is sent back.`,
      confirmLabel: "Submit claim",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      const result = await persist(lines, true);
      const next = firstPendingStep(result.approvals);
      toast("Settlement submitted", `${travelRequestId} · ${formatRupees(result.net_reimbursable)} · with ${next?.approver_name ?? "Finance"} for review`);
      navigate(paths.trip(travelRequestId));
    } catch (err) {
      setError(errorMessage(err, "Could not submit settlement"));
      setSaving(false);
    }
  }

  // receipts this line may link to: unused ones plus its own
  const editing = editor?.index != null ? expenses[editor.index] : undefined;
  const usedProofs = new Set(expenses.map((line) => line.proof_ref).filter((ref) => ref && ref !== editing?.proof_ref));
  const freeReceipts = receipts.filter((receipt) => !usedProofs.has(String(receipt.id)));
  const claimedReceiptIds = new Set(expenses.map(receiptIdOf).filter((id): id is string => id != null));
  const unclaimedReceipts = receipts.filter((receipt) => !claimedReceiptIds.has(String(receipt.id)));

  function viewReceipt(id: string) {
    setViewing({ id, name: receiptsById.get(id)?.original_name ?? `Receipt #${id}` });
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      {dialog}
      {/* full-page drop target while a file is dragged over the window */}
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-teal-950/30 p-6 backdrop-blur-[2px] animate-fade">
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-white bg-white/90 px-10 py-8 text-center shadow-xl">
            <Upload className="h-8 w-8 text-teal-700" aria-hidden />
            <p className="text-base font-semibold text-teal-950">Drop to upload your bill</p>
            <p className="text-xs text-slate-500">We'll scan it and pre-fill the expense</p>
          </div>
        </div>
      ) : null}
      <PageHeader
        eyebrow="Settlement"
        title={travelRequestId}
        aside={
          <StatusBadge
            status={trip.status}
            settlementStatus={settlement?.status}
            label={editable ? (returnedRemarks.length > 0 ? "Sent back" : "Draft") : undefined}
          />
        }
      >
        {/* Policy this claim is checked against */}
        <PolicyReference rules={SETTLEMENT_RULES} />
      </PageHeader>

      {/* Where the trip is in the overall flow */}
      <TripFlow request={trip} settlement={settlement} captions="active" />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {returnedRemarks.length > 0 ? (
        <Alert tone="info" title="Sent back for changes">
          <ul className="list-disc pl-5">
            {returnedRemarks.map((step) => (
              <li key={step.id}>
                {step.approver_name ?? step.role_required}: {step.remarks}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {isOwner && !tripOpen && waitingOnAdvance ? (
        <Alert tone="info" title="Settlement opens after the advance">
          Finance is processing your advance. You can upload bills and claim expenses once
          it is released or declined.
        </Alert>
      ) : isOwner && !tripOpen && !settlement ? (
        <Alert tone="info" title="Settlement opens after approval">
          You can claim expenses once the travel request is approved.
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          {editable ? (
            <ReceiptDropzone
              uploading={uploading}
              dragging={dragging}
              onFile={(file) => void onFile(file)}
              onManual={() => setEditor({ index: null })}
            />
          ) : null}

          {/* claimed lines, grouped by section */}
          {expenses.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
              {editable ? "No expenses yet. Upload your first bill to get started." : "No expenses on this settlement."}
            </p>
          ) : (
            EXPENSE_SECTIONS.map(({ value, label, icon: Icon }) => {
              const rows = expenses
                .map((line, index) => ({ line, index }))
                .filter(({ line }) => line.section === value);
              if (rows.length === 0) return null;
              const subtotal = rows.reduce((sum, { line }) => sum + Number(line.amount), 0);
              return (
                <section key={value} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      {Icon ? <Icon className="h-4 w-4 text-teal-700" aria-hidden /> : null}
                      {label}
                      <span className="font-normal text-slate-500">· {rows.length}</span>
                    </h2>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{formatRupees(subtotal)}</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {rows.map(({ line, index }) => (
                      <ExpenseRow
                        key={line.id ?? index}
                        line={line}
                        receipt={receiptsById.get(receiptIdOf(line) ?? "")}
                        editable={editable && !saving}
                        onEdit={() => setEditor({ index })}
                        onRemove={() => void onRemove(index)}
                        onViewReceipt={() => viewReceipt(line.proof_ref ?? "")}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}

          {/* bills uploaded but not on an expense yet (claimed ones show on their line) */}
          {unclaimedReceipts.length > 0 ? (
            <UnclaimedBills
              receipts={unclaimedReceipts}
              editable={editable && !saving}
              onView={(receipt) => viewReceipt(String(receipt.id))}
              onAdd={(receipt) => setEditor({ index: null, scanReceipt: receipt })}
              onDelete={(receipt) => void onDeleteBill(receipt)}
            />
          ) : null}
        </div>

        {/* live settlement summary + submit */}
        <aside className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold text-slate-800">Settlement summary</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <SummaryRow label="Paid by you" value={formatRupees(figures.claimed)} />
            <SummaryRow label="Not claimable" value={`− ${formatRupees(figures.disallowed)}`} />
            <SummaryRow label="Net claim" value={formatRupees(figures.net)} />
            <SummaryRow label="Advance received" value={`− ${formatRupees(figures.advance)}`} />
            <div className="my-1 border-t border-slate-200" />
            {figures.recoverable > 0 ? (
              <SummaryRow label="You return" value={formatRupees(figures.recoverable)} strong />
            ) : (
              <SummaryRow label="You receive" value={formatRupees(figures.payable)} strong />
            )}
            {/* desk bookings etc. — recorded, never paid out to the employee */}
            <div className="my-1 border-t border-dashed border-slate-200" />
            <SummaryRow label="Paid by company" hint="Memo only, not reimbursed" value={formatRupees(figures.company)} />
          </dl>

          {editable ? (
            <>
              <ul className="flex flex-col gap-1.5 border-t border-slate-200 pt-4 text-sm">
                <CheckItem done={expenses.length > 0}>At least one expense</CheckItem>
                <CheckItem done={expenses.length > 0 && missingReceipts === 0}>
                  {missingReceipts > 0 ? `Receipts missing on ${missingReceipts} expense(s)` : "Every expense has a receipt"}
                </CheckItem>
              </ul>
              <Button
                disabled={saving || expenses.length === 0 || missingReceipts > 0}
                onClick={() => void onSubmit()}
              >
                {saving ? "Saving…" : "Submit for Finance review"}
              </Button>
              <p className="text-xs text-slate-500">Changes save automatically as a draft.</p>
            </>
          ) : null}

          {can("release_funds") &&
          settlement &&
          (settlement.status === "queued_for_payment" || settlement.status === "recoverable") ? (
            // Finance pays / records recovery from its own review page
            <LinkButton to={paths.financeReview(travelRequestId)} variant="primary">
              Open in Finance
            </LinkButton>
          ) : null}
        </aside>
      </div>

      {editor ? (
        <ExpenseEditor
          key={editor.scanReceipt?.id ?? editor.index ?? "new"}
          travelRequestId={travelRequestId}
          initial={editing ? toDraft(editing) : undefined}
          scanReceipt={editor.scanReceipt}
          receipts={freeReceipts}
          trip={tripWindow}
          saving={saving}
          apiError={editorError}
          onCancel={closeEditor}
          onSave={(draft) => void onSaveExpense(draft)}
        />
      ) : null}

      {viewing ? (
        <ReceiptViewer
          key={viewing.id}
          travelRequestId={travelRequestId}
          receiptId={viewing.id}
          name={viewing.name}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}
