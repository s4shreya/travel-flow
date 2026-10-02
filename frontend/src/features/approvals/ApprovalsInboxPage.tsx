import { useEffect, useState } from "react";

import { fetchApprovalInbox, type ApprovalInboxItem } from "@/api/approvals";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { QueueTable } from "@/components/ui/QueueTable";
import { useEmployee } from "@/context/EmployeeContext";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";

/** Queue of items waiting on me; each row opens the review page to decide. */
export function ApprovalsInboxPage() {
  const { can } = useEmployee();
  const allowed = can("approve_requests");
  const [rows, setRows] = useState<ApprovalInboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(allowed);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    // load items waiting on me
    fetchApprovalInbox()
      .then((items) => {
        if (!cancelled) setRows(items);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load inbox"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return <Alert tone="error">You do not have access to approvals.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader eyebrow="Approvals" title="Inbox" />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <PageLoader /> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-slate-600">No pending approvals.</p>
      ) : null}

      {rows.length > 0 ? (
        <QueueTable
          rows={rows.map((row) => ({
            key: `${row.kind}-${row.approval_id}`,
            travelRequestId: row.travel_request_id,
            href: paths.review(row.travel_request_id),
            employee: row.requester_name,
            destination: row.destination,
            // which chain, and my level in it
            stage: row.kind === "settlement" ? "Finance Review" : "Trip approval",
            stageHint: `Level ${row.level} of ${row.approvals.length} · waiting on you`,
            amount: row.amount,
            submittedAt: row.created_at,
          }))}
        />
      ) : null}
    </div>
  );
}
