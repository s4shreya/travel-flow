import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { listReceipts, type Receipt } from "@/api/receipts";
import {
  getSettlement,
  markSettlementPaid,
  saveSettlement,
  type Settlement,
  type SettlementExpense,
} from "@/api/settlements";
import { getTravelRequest } from "@/api/travelRequests";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { useEmployee } from "@/context/EmployeeContext";
import {
  currentPendingForEmployee,
  DecisionActions,
} from "@/features/approvals/DecisionActions";
import {
  EMPTY_LODGING,
  EMPTY_OTHER,
  EMPTY_TRANSPORT,
  settlementHasErrors,
  toSettlementExpenses,
  validateSettlementForm,
  type LodgingLine,
  type OtherLine,
  type SettlementLineErrors,
  type TransportLine,
} from "@/features/travel-requests/settlementFormModel";
import {
  formatAmountValue,
  formatMoneyInput,
  parseMoney,
  toApiAmount,
} from "@/lib/money";
import { formatDecision, formatSettlementStatus } from "@/lib/statusLabels";

const PAID_BY_OPTIONS = [
  { value: "Employee", label: "Employee" },
  { value: "Company", label: "Company" },
];

const MODE_OPTIONS = [
  { value: "Flight", label: "Flight" },
  { value: "Rail", label: "Rail" },
  { value: "Cab", label: "Cab" },
  { value: "Bus", label: "Bus" },
  { value: "Other", label: "Other" },
];

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function sumAmounts(rows: { amount: string; paid_by: string }[], paidBy?: string) {
  return rows.reduce((total, row) => {
    if (paidBy && row.paid_by !== paidBy) return total;
    const amount = parseMoney(row.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function splitExpenses(expenses: SettlementExpense[]) {
  const lodging: LodgingLine[] = [];
  const transport: TransportLine[] = [];
  const other: OtherLine[] = [];
  for (const row of expenses) {
    if (row.section === "lodging") {
      lodging.push({
        check_in: row.check_in ?? "",
        check_out: row.check_out ?? "",
        hotel_name: row.hotel_name ?? "",
        city: row.city ?? "",
        paid_by: row.paid_by,
        amount: String(row.amount ?? ""),
        proof_ref: row.proof_ref ?? "",
      });
    } else if (row.section === "transport") {
      transport.push({
        expense_date: row.expense_date ?? "",
        expense_time: row.expense_time ? String(row.expense_time).slice(0, 5) : "",
        from_location: row.from_location ?? "",
        to_location: row.to_location ?? "",
        mode: row.mode ?? "Cab",
        paid_by: row.paid_by,
        amount: String(row.amount ?? ""),
        proof_ref: row.proof_ref ?? "",
      });
    } else {
      other.push({
        expense_date: row.expense_date ?? "",
        head: row.head ?? "",
        description: row.description ?? "",
        paid_by: row.paid_by,
        amount: String(row.amount ?? ""),
        proof_ref: row.proof_ref ?? "",
      });
    }
  }
  return {
    lodging: lodging.length ? lodging : [{ ...EMPTY_LODGING }],
    transport: transport.length ? transport : [{ ...EMPTY_TRANSPORT }],
    other: other.length ? other : [{ ...EMPTY_OTHER }],
  };
}

function CellError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-red-700">{message}</p>;
}

function SectionTable({
  title,
  children,
  total,
  onAdd,
  locked,
}: {
  title: string;
  children: ReactNode;
  total: number;
  onAdd?: () => void;
  locked: boolean;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-teal-950 px-4 py-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
          {title}
        </h2>
        {!locked && onAdd ? (
          <Button
            type="button"
            variant="secondary"
            className="bg-white px-3 py-1.5 text-xs"
            onClick={onAdd}
          >
            Add row
          </Button>
        ) : null}
      </div>
      {children}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
        <span className="font-medium text-slate-700">{title} total</span>
        <span className="tabular-nums font-semibold text-slate-900">
          ₹{formatAmountValue(total)}
        </span>
      </div>
    </section>
  );
}

export function SettlementPage() {
  const { travelRequestId = "" } = useParams();
  const { employeeCode, employee, can } = useEmployee();
  const [lodging, setLodging] = useState<LodgingLine[]>([{ ...EMPTY_LODGING }]);
  const [transport, setTransport] = useState<TransportLine[]>([
    { ...EMPTY_TRANSPORT },
  ]);
  const [other, setOther] = useState<OtherLine[]>([{ ...EMPTY_OTHER }]);
  const [disallowed, setDisallowed] = useState("0");
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [advanceDisbursed, setAdvanceDisbursed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [lineErrors, setLineErrors] = useState<SettlementLineErrors>({
    lodging: {},
    transport: {},
    other: {},
  });
  const [actionSuccess, setActionSuccess] = useState<{
    title: string;
    body: string;
  } | null>(null);

  const locked =
    settlement != null &&
    settlement.status !== "draft" &&
    settlement.status !== "returned";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [trip, existing, receiptRows] = await Promise.all([
          getTravelRequest(employeeCode, travelRequestId),
          getSettlement(employeeCode, travelRequestId),
          listReceipts(employeeCode, travelRequestId),
        ]);
        if (cancelled) return;
        setAdvanceDisbursed(Number(trip.advance_disbursed) || 0);
        setReceipts(receiptRows);
        setSettlement(existing);
        if (existing) {
          const split = splitExpenses(existing.expenses);
          setLodging(split.lodging);
          setTransport(split.transport);
          setOther(split.other);
          setDisallowed(String(existing.disallowed_total ?? "0"));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load settlement",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [employeeCode, travelRequestId]);

  const proofOptions = useMemo(
    () => [
      { value: "", label: "Select…" },
      ...receipts.map((receipt) => ({
        value: String(receipt.id),
        label: `${receipt.original_name} (#${receipt.id})`,
      })),
    ],
    [receipts],
  );

  const lodgingTotal = sumAmounts(lodging);
  const transportTotal = sumAmounts(transport);
  const otherTotal = sumAmounts(other);
  const employeePaid =
    sumAmounts(lodging, "Employee") +
    sumAmounts(transport, "Employee") +
    sumAmounts(other, "Employee");
  const companyPaid =
    sumAmounts(lodging, "Company") +
    sumAmounts(transport, "Company") +
    sumAmounts(other, "Company");
  const disallowedNum = parseMoney(disallowed) || 0;
  // Employee claim only — company-paid lines are memo, not reimbursed
  const net = Math.max(employeePaid - disallowedNum, 0);
  // Full advance released; excess over net is recoverable
  const advanceApplied = advanceDisbursed;
  const balance = net - advanceApplied;
  const payable = balance > 0 ? balance : 0;
  const recoverable = balance < 0 ? Math.abs(balance) : 0;

  async function save(submit: boolean) {
    setError(null);
    setMessage(null);
    const nextErrors = validateSettlementForm(lodging, transport, other);
    setLineErrors(nextErrors);
    if (settlementHasErrors(nextErrors)) {
      setError(nextErrors.form ?? "Fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      const expenses = toSettlementExpenses(lodging, transport, other);

      const result = await saveSettlement(employeeCode, travelRequestId, {
        expenses,
        disallowed_total: toApiAmount(disallowedNum),
        submit,
      });
      setSettlement(result);
      const split = splitExpenses(result.expenses);
      setLodging(split.lodging);
      setTransport(split.transport);
      setOther(split.other);
      setDisallowed(String(result.disallowed_total ?? "0"));
      setLineErrors({ lodging: {}, transport: {}, other: {} });
      if (submit) {
        // Hide the form and show success (same pattern as travel request create)
        setSubmitted(true);
        setMessage(null);
      } else {
        setMessage("Draft saved");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onMarkPaid() {
    setSaving(true);
    setError(null);
    try {
      const result = await markSettlementPaid(employeeCode, travelRequestId);
      setSettlement(result);
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
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  // Success-only view after claim submit / approve / release
  if ((submitted || actionSuccess) && settlement) {
    const title =
      actionSuccess?.title ?? "Settlement claim submitted";
    const body =
      actionSuccess?.body ??
      `Claim for ${settlement.travel_request_id} is in the approval chain.`;
    return (
      <div className="flex flex-col gap-6 animate-in">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
            Travel expense settlement
          </p>
          <h1 className="font-display mt-2 text-3xl text-teal-950">
            {travelRequestId}
          </h1>
        </div>

        <Alert tone="success" title={title}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p>{body}</p>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-teal-900">
              {formatSettlementStatus(settlement.status)}
            </span>
          </div>
          {settlement.approvals.length > 0 ? (
            <ul className="mt-3 list-disc pl-5">
              {settlement.approvals.map((step) => (
                <li key={step.id}>
                  Level {step.level}: {step.role_required} —{" "}
                  {formatDecision(step.decision)}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-sm">
            Net reimbursable ₹{formatAmountValue(settlement.net_reimbursable)}
            {Number(settlement.amount_payable) > 0
              ? ` · payable ₹${formatAmountValue(settlement.amount_payable)}`
              : null}
            {Number(settlement.amount_recoverable) > 0
              ? ` · recoverable ₹${formatAmountValue(settlement.amount_recoverable)}`
              : null}
          </p>
        </Alert>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to={`/travel-requests/${travelRequestId}`}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            View trip
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

  const th =
    "px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const cell = "px-2 py-2 align-top";

  return (
    <div className="flex flex-col gap-6 animate-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
            Travel expense settlement
          </p>
          <h1 className="font-display mt-2 text-3xl text-teal-950">
            {travelRequestId}
          </h1>
        </div>
        {settlement ? (
          <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900">
            {formatSettlementStatus(settlement.status)}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-slate-600">
        Add expenses here.{" "}
        <Link
          to={`/travel-requests/${travelRequestId}`}
          className="font-medium text-teal-800"
        >
          View trip
        </Link>
      </p>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      {/* LODGING */}
      <SectionTable
        title="Lodging"
        total={lodgingTotal}
        locked={locked}
        onAdd={() => setLodging((prev) => [...prev, { ...EMPTY_LODGING }])}
      >
        <table className="min-w-[56rem] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Check in</th>
              <th className={th}>Check out</th>
              <th className={`${th} w-16`}>Nights</th>
              <th className={th}>Hotel name</th>
              <th className={th}>City</th>
              <th className={th}>Paid by</th>
              <th className={th}>Amount</th>
              <th className={th}>Proof ref</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {lodging.map((row, index) => (
              <tr key={`lodge-${index}`} className="border-t border-slate-100">
                <td className={cell}>
                  <Input
                    type="date"
                    value={row.check_in}
                    disabled={locked}
                    onChange={(e) =>
                      setLodging((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, check_in: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.lodging[index]?.check_in} />
                </td>
                <td className={cell}>
                  <Input
                    type="date"
                    value={row.check_out}
                    disabled={locked}
                    onChange={(e) =>
                      setLodging((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, check_out: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.lodging[index]?.check_out} />
                </td>
                <td className={`${cell} tabular-nums text-slate-600`}>
                  {nightsBetween(row.check_in, row.check_out) || "—"}
                </td>
                <td className={cell}>
                  <Input
                    value={row.hotel_name}
                    disabled={locked}
                    placeholder="Hotel"
                    onChange={(e) =>
                      setLodging((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, hotel_name: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.lodging[index]?.hotel_name} />
                </td>
                <td className={cell}>
                  <Input
                    value={row.city}
                    disabled={locked}
                    placeholder="City"
                    onChange={(e) =>
                      setLodging((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, city: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.lodging[index]?.city} />
                </td>
                <td className={cell}>
                  <SelectMenu
                    id={`lodge-paid-${index}`}
                    value={row.paid_by}
                    options={PAID_BY_OPTIONS}
                    disabled={locked}
                    onChange={(value) =>
                      setLodging((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, paid_by: value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  <Input
                    className="text-right"
                    value={row.amount}
                    disabled={locked}
                    onChange={(e) =>
                      setLodging((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, amount: formatMoneyInput(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.lodging[index]?.amount} />
                </td>
                <td className={cell}>
                  <SelectMenu
                    id={`lodge-proof-${index}`}
                    value={row.proof_ref}
                    options={proofOptions}
                    disabled={locked}
                    onChange={(value) =>
                      setLodging((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, proof_ref: value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  {!locked && lodging.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2"
                      onClick={() =>
                        setLodging((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      {/* TRANSPORT */}
      <SectionTable
        title="Travel & transportation"
        total={transportTotal}
        locked={locked}
        onAdd={() => setTransport((prev) => [...prev, { ...EMPTY_TRANSPORT }])}
      >
        <table className="min-w-[56rem] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Time</th>
              <th className={th}>From</th>
              <th className={th}>To</th>
              <th className={th}>Mode</th>
              <th className={th}>Paid by</th>
              <th className={th}>Amount</th>
              <th className={th}>Proof ref</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {transport.map((row, index) => (
              <tr key={`tx-${index}`} className="border-t border-slate-100">
                <td className={cell}>
                  <Input
                    type="date"
                    value={row.expense_date}
                    disabled={locked}
                    onChange={(e) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, expense_date: e.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.transport[index]?.expense_date} />
                </td>
                <td className={cell}>
                  <Input
                    type="time"
                    value={row.expense_time}
                    disabled={locked}
                    onChange={(e) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, expense_time: e.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  <Input
                    value={row.from_location}
                    disabled={locked}
                    onChange={(e) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, from_location: e.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                  <CellError
                    message={lineErrors.transport[index]?.from_location}
                  />
                </td>
                <td className={cell}>
                  <Input
                    value={row.to_location}
                    disabled={locked}
                    onChange={(e) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, to_location: e.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                  <CellError
                    message={lineErrors.transport[index]?.to_location}
                  />
                </td>
                <td className={cell}>
                  <SelectMenu
                    id={`tx-mode-${index}`}
                    value={row.mode}
                    options={MODE_OPTIONS}
                    disabled={locked}
                    onChange={(value) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, mode: value } : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.transport[index]?.mode} />
                </td>
                <td className={cell}>
                  <SelectMenu
                    id={`tx-paid-${index}`}
                    value={row.paid_by}
                    options={PAID_BY_OPTIONS}
                    disabled={locked}
                    onChange={(value) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, paid_by: value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  <Input
                    className="text-right"
                    value={row.amount}
                    disabled={locked}
                    onChange={(e) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, amount: formatMoneyInput(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.transport[index]?.amount} />
                </td>
                <td className={cell}>
                  <SelectMenu
                    id={`tx-proof-${index}`}
                    value={row.proof_ref}
                    options={proofOptions}
                    disabled={locked}
                    onChange={(value) =>
                      setTransport((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, proof_ref: value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  {!locked && transport.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2"
                      onClick={() =>
                        setTransport((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      {/* OTHER */}
      <SectionTable
        title="Other expenses"
        total={otherTotal}
        locked={locked}
        onAdd={() => setOther((prev) => [...prev, { ...EMPTY_OTHER }])}
      >
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Head</th>
              <th className={th}>Description</th>
              <th className={th}>Paid by</th>
              <th className={th}>Amount</th>
              <th className={th}>Proof ref</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {other.map((row, index) => (
              <tr key={`ot-${index}`} className="border-t border-slate-100">
                <td className={cell}>
                  <Input
                    type="date"
                    value={row.expense_date}
                    disabled={locked}
                    onChange={(e) =>
                      setOther((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, expense_date: e.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.other[index]?.expense_date} />
                </td>
                <td className={cell}>
                  <Input
                    value={row.head}
                    disabled={locked}
                    placeholder="Meals / Entertainment"
                    onChange={(e) =>
                      setOther((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, head: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.other[index]?.head} />
                </td>
                <td className={cell}>
                  <Input
                    value={row.description}
                    disabled={locked}
                    onChange={(e) =>
                      setOther((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, description: e.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  <SelectMenu
                    id={`ot-paid-${index}`}
                    value={row.paid_by}
                    options={PAID_BY_OPTIONS}
                    disabled={locked}
                    onChange={(value) =>
                      setOther((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, paid_by: value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  <Input
                    className="text-right"
                    value={row.amount}
                    disabled={locked}
                    onChange={(e) =>
                      setOther((prev) =>
                        prev.map((r, i) =>
                          i === index
                            ? { ...r, amount: formatMoneyInput(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                  <CellError message={lineErrors.other[index]?.amount} />
                </td>
                <td className={cell}>
                  <SelectMenu
                    id={`ot-proof-${index}`}
                    value={row.proof_ref}
                    options={proofOptions}
                    disabled={locked}
                    onChange={(value) =>
                      setOther((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, proof_ref: value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className={cell}>
                  {!locked && other.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2"
                      onClick={() =>
                        setOther((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      {/* SUMMARY */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-teal-950 px-4 py-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
            Settlement summary
          </h2>
        </div>
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-slate-700">Total claim — paid by employee</dt>
            <dd className="tabular-nums font-medium">
              ₹{formatAmountValue(employeePaid)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-slate-700">
              Total paid by company (memo only, not reimbursed)
            </dt>
            <dd className="tabular-nums font-medium">
              ₹{formatAmountValue(companyPaid)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-slate-700">Less: non-reimbursable / disallowed</dt>
            <dd className="tabular-nums font-medium">
              ₹{formatAmountValue(disallowedNum)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-slate-700">Net reimbursable claim</dt>
            <dd className="tabular-nums font-medium">
              ₹{formatAmountValue(net)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-slate-700">Less: travel advance drawn</dt>
            <dd className="tabular-nums font-medium">
              ₹{formatAmountValue(advanceApplied)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 bg-slate-50 px-4 py-3">
            <dt className="font-semibold text-slate-900">
              Amount payable to employee
            </dt>
            <dd className="tabular-nums font-semibold text-teal-900">
              ₹{formatAmountValue(payable)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="font-semibold text-slate-900">
              Amount recoverable from employee
            </dt>
            <dd className="tabular-nums font-semibold text-slate-900">
              ₹{formatAmountValue(recoverable)}
            </dd>
          </div>
        </dl>
      </section>

      {!locked ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void save(false)}
          >
            Save draft
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void save(true)}
          >
            {saving ? "Submitting…" : "Submit claim"}
          </Button>
        </div>
      ) : null}

      {(() => {
        const pending =
          settlement && employee
            ? currentPendingForEmployee(settlement.approvals, employee.id)
            : null;
        if (!pending) return null;
        return (
          <DecisionActions
            employeeCode={employeeCode}
            approvalId={pending.id}
            kind="settlement"
            busy={actionBusy}
            onBusy={setActionBusy}
            onError={(msg) => setError(msg || null)}
            onDone={(decision) => {
              void (async () => {
                const existing = await getSettlement(
                  employeeCode,
                  travelRequestId,
                );
                setSettlement(existing);
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
        );
      })()}

      {can("release_funds") &&
      settlement &&
      (settlement.status === "queued_for_payment" ||
        settlement.status === "recoverable") ? (
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={saving}
            onClick={() => void onMarkPaid()}
          >
            {settlement.status === "recoverable" ||
            Number(settlement.amount_recoverable) > 0
              ? "Note payroll recovery"
              : "Release settlement funds"}
          </Button>
        </div>
      ) : null}

      {settlement && settlement.approvals.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            Settlement approvals
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {settlement.approvals.map((step) => (
              <li
                key={step.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  Level {step.level}: {step.role_required}
                </span>
                <span className="font-medium">
                  {formatDecision(step.decision)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
