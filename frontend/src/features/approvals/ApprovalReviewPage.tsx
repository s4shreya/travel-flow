import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { ApprovalKind } from "@/api/approvals";
import type { Settlement } from "@/api/settlements";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { useEmployee } from "@/context/EmployeeContext";
import { useToast } from "@/context/ToastContext";
import { DecisionActions } from "@/features/approvals/DecisionActions";
import { loadTripWithSettlement } from "@/features/travel-requests/loadTrip";
import {
  ExpenseLinesCard,
  ReviewHeader,
  TripAmounts,
  TripFlow,
  TripSummaryCard,
} from "@/features/travel-requests/TripSummary";
import { currentPendingForEmployee, decisionCopy } from "@/lib/approvals";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";
import type { TravelRequest } from "@/types/travelRequest";

// Approve button / chain title per approval kind
const STAGE_LABEL: Record<ApprovalKind, string> = {
  travel_request: "Trip approval",
  settlement: "Finance review",
};

/** Approver's view of one request: decide in the header, evidence below. */
export function ApprovalReviewPage() {
  const { travelRequestId = "" } = useParams();
  const { employee, can } = useEmployee();
  const navigate = useNavigate();
  const toast = useToast();
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // load the trip and its settlement (if any)
    loadTripWithSettlement(travelRequestId)
      .then(({ trip, settlement: row }) => {
        if (cancelled) return;
        setRequest(trip);
        setSettlement(row);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load request"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [travelRequestId]);

  if (!can("approve_requests")) {
    return <Alert tone="error">You do not have access to approvals.</Alert>;
  }
  if (loading) return <PageLoader />;
  if (!request) return <Alert tone="error">{error ?? "Request not found"}</Alert>;

  // Which chain is waiting on me: the trip request first, then its settlement
  const requestPending = employee ? currentPendingForEmployee(request.approvals, employee.id) : null;
  const settlementPending =
    employee && settlement ? currentPendingForEmployee(settlement.approvals, employee.id) : null;
  const pending = requestPending ?? settlementPending;
  const kind: ApprovalKind = settlementPending && !requestPending ? "settlement" : "travel_request";
  const isSettlement = kind === "settlement";
  const amount = isSettlement && settlement ? settlement.net_reimbursable : request.estimated_cost;

  return (
    <div className="flex flex-col gap-6 animate-in">
      <ReviewHeader
        request={request}
        settlement={settlement}
        amount={amount}
        badgeLabel={pending ? "Awaiting your approval" : undefined}
      >
        {pending ? (
          <DecisionActions
            approvalId={pending.id}
            kind={kind}
            stage={STAGE_LABEL[kind]}
            amount={Number(amount)}
            busy={busy}
            onBusy={setBusy}
            onError={(msg) => setError(msg || null)}
            onDone={(decision) => {
              // back to the queue with a confirmation
              const copy = decisionCopy(kind, request.travel_request_id, decision);
              toast(copy.title, copy.body);
              navigate(paths.approvals);
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">No action needed from you on this request.</p>
        )}
      </ReviewHeader>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* where it is in the flow + who has signed off */}
      <TripFlow request={request} settlement={settlement} youId={pending?.id} captions="active" />

      {/* key figures */}
      <TripAmounts request={request} settlement={isSettlement ? settlement : null} />

      {/* evidence: claim lines for a settlement, then the request summary (full form on its own page) */}
      {isSettlement && settlement ? <ExpenseLinesCard settlement={settlement} /> : null}
      <TripSummaryCard request={request} to={paths.reviewForm(request.travel_request_id)} />
    </div>
  );
}
