import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { Settlement } from "@/api/settlements";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { useEmployee } from "@/context/EmployeeContext";
import { useToast } from "@/context/ToastContext";
import { FinanceActions } from "@/features/finance/FinanceActions";
import { financeTaskFor } from "@/features/finance/financeTasks";
import { loadTripWithSettlement } from "@/features/travel-requests/loadTrip";
import {
  ExpenseLinesCard,
  ReviewHeader,
  TripAmounts,
  TripFlow,
  TripSummaryCard,
} from "@/features/travel-requests/TripSummary";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";
import type { TravelRequest } from "@/types/travelRequest";

/** Finance's view of one trip: release the advance or settle the claim from the header. */
export function FinanceReviewPage() {
  const { travelRequestId = "" } = useParams();
  const { can } = useEmployee();
  const navigate = useNavigate();
  const toast = useToast();
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (!can("release_funds")) {
    return <Alert tone="error">You do not have access to release funds.</Alert>;
  }
  if (loading) return <PageLoader />;
  if (!request) return <Alert tone="error">{error ?? "Request not found"}</Alert>;

  // What Finance owes now: the advance first, then the settlement payout / recovery
  const task = financeTaskFor(request, settlement);
  const isSettlement = task != null && task.kind !== "advance";

  return (
    <div className="flex flex-col gap-6 animate-in">
      {/* header: id, status, one-line summary, the Finance actions */}
      <ReviewHeader
        request={request}
        settlement={settlement}
        amount={task?.amount ?? request.estimated_cost}
        badgeLabel={task ? "Awaiting Finance" : undefined}
      >
        {task ? (
          <FinanceActions
            travelRequestId={request.travel_request_id}
            task={task}
            onError={(msg) => setError(msg || null)}
            onDone={({ title, body }) => {
              // back to the queue with a confirmation
              toast(title, body);
              navigate(paths.finance);
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">No pending payments for this request.</p>
        )}
      </ReviewHeader>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* where it is in the flow + who has signed off */}
      <TripFlow request={request} settlement={settlement} captions="active" />

      {/* key figures */}
      <TripAmounts request={request} settlement={isSettlement ? settlement : null} />

      {/* evidence: claim lines for a settlement, then the request summary (full form on its own page) */}
      {isSettlement && settlement ? <ExpenseLinesCard settlement={settlement} /> : null}
      <TripSummaryCard request={request} to={paths.financeForm(request.travel_request_id)} />
    </div>
  );
}
