import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchAdvancesQueue,
  fetchSettlementPaymentsQueue,
} from "@/api/finance";
import { markSettlementPaid } from "@/api/settlements";
import {
  releaseAdvance,
  type TravelRequestListItem,
} from "@/api/travelRequests";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useEmployee } from "@/context/EmployeeContext";
import { formatAmountValue } from "@/lib/money";

export function FinanceAdvancesPage() {
  const { employeeCode, can } = useEmployee();
  const [advances, setAdvances] = useState<TravelRequestListItem[]>([]);
  const [settlements, setSettlements] = useState<TravelRequestListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [advanceRows, settlementRows] = await Promise.all([
        fetchAdvancesQueue(employeeCode),
        fetchSettlementPaymentsQueue(employeeCode),
      ]);
      setAdvances(advanceRows);
      setSettlements(settlementRows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load finance queues"
      );
    } finally {
      setLoading(false);
    }
  }, [employeeCode]);

  useEffect(() => {
    if (!can("release_funds")) {
      setLoading(false);
      return;
    }
    void load();
  }, [can, load]);

  async function onReleaseAdvance(row: TravelRequestListItem) {
    const remaining =
      Number(row.advance_requested) - Number(row.advance_disbursed);
    setBusyId(row.travel_request_id);
    setError(null);
    try {
      await releaseAdvance(
        employeeCode,
        row.travel_request_id,
        remaining.toFixed(2),
        `ADV/${row.travel_request_id}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onSettlementPayment(row: TravelRequestListItem) {
    setBusyId(row.travel_request_id);
    setError(null);
    try {
      await markSettlementPaid(employeeCode, row.travel_request_id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!can("release_funds")) {
    return <Alert tone="error">You do not have access to release funds.</Alert>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
          Finance
        </p>
        <h1 className="font-display mt-2 text-3xl text-teal-950">
          Advances & Settlements
        </h1>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Travel advances to release
        </h2>
        {!loading && advances.length === 0 ? (
          <p className="text-sm text-slate-600">No travel advances waiting.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {advances.map((row) => (
            <li
              key={`adv-${row.travel_request_id}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <p className="font-semibold text-slate-900">
                <Link
                  to={`/travel-requests/${row.travel_request_id}`}
                  className="text-teal-900 hover:underline"
                >
                  {row.travel_request_id}
                </Link>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {row.destination} · requested ₹
                {formatAmountValue(row.advance_requested)} · paid ₹
                {formatAmountValue(row.advance_disbursed)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={busyId === row.travel_request_id}
                  onClick={() => void onReleaseAdvance(row)}
                >
                  Release Advance Funds
                </Button>
                <Link
                  to={`/travel-requests/${row.travel_request_id}`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  View travel request
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Settlement payments
        </h2>

        {!loading && settlements.length === 0 ? (
          <p className="text-sm text-slate-600">
            No settlement payments waiting.
          </p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {settlements.map((row) => {
            const payable = Number(row.settlement_amount_payable || 0);
            const recoverable = Number(row.settlement_amount_recoverable || 0);
            const isRecovery =
              row.settlement_status === "recoverable" ||
              (recoverable > 0 && payable <= 0);
            return (
              <li
                key={`pay-${row.travel_request_id}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <p className="font-semibold text-slate-900">
                  <Link
                    to={`/travel-requests/${row.travel_request_id}/settlement`}
                    className="text-teal-900 hover:underline"
                  >
                    {row.travel_request_id}
                  </Link>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {row.destination}
                  {payable > 0
                    ? ` · payable ₹${formatAmountValue(payable)}`
                    : null}
                  {recoverable > 0
                    ? ` · recoverable ₹${formatAmountValue(recoverable)}`
                    : null}
                </p>
                {row.progress_label ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {row.progress_label}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={busyId === row.travel_request_id}
                    onClick={() => void onSettlementPayment(row)}
                  >
                    {isRecovery
                      ? "Note payroll recovery"
                      : "Release Settlement Payment"}
                  </Button>
                  <Link
                    to={`/travel-requests/${row.travel_request_id}`}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    View travel request
                  </Link>
                  <Link
                    to={`/travel-requests/${row.travel_request_id}/settlement`}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    View settlement
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
