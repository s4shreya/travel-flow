import { useEffect, useState } from "react";

import { fetchAdvancesQueue, fetchSettlementPaymentsQueue } from "@/api/finance";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { QueueTable } from "@/components/ui/QueueTable";
import { useEmployee } from "@/context/EmployeeContext";
import { FINANCE_TASK, financeRows, type FinanceRow } from "@/features/finance/financeTasks";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";
import { NOT_SET } from "@/lib/text";

/** Advances and settlements waiting on Finance; each row opens the review page to act. */
export function FinanceInboxPage() {
  const { can } = useEmployee();
  const allowed = can("release_funds");
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(allowed);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    // load both Finance queues
    Promise.all([fetchAdvancesQueue(), fetchSettlementPaymentsQueue()])
      .then(([advanceRows, settlementRows]) => {
        if (!cancelled) setRows(financeRows(advanceRows, settlementRows));
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load finance queues"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return <Alert tone="error">You do not have access to release funds.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader eyebrow="Finance" title="Payments" />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <PageLoader /> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-slate-600">No pending payments.</p>
      ) : null}

      {rows.length > 0 ? (
        <QueueTable
          stageHeader="Task"
          rows={rows.map(({ row, task }) => ({
            key: `${task.kind}-${row.travel_request_id}`,
            travelRequestId: row.travel_request_id,
            href: paths.financeReview(row.travel_request_id),
            employee: row.employee_name ?? "—",
            destination: row.destination ?? NOT_SET,
            // advance after trip approval, payout / recovery after settlement approval
            stage: FINANCE_TASK[task.kind].label,
            stageHint: task.kind === "advance" ? "Trip approved · waiting on you" : "Settlement approved · waiting on you",
            amount: task.amount,
            submittedAt: row.created_at,
          }))}
        />
      ) : null}
    </div>
  );
}
