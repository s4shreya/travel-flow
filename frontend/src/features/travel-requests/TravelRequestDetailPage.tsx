import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import type { Settlement } from "@/api/settlements";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { LinkButton } from "@/components/ui/LinkButton";
import { PolicyReference } from "@/components/ui/PolicyReference";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEmployee } from "@/context/EmployeeContext";
import { financeTaskFor } from "@/features/finance/financeTasks";
import { loadTripWithSettlement } from "@/features/travel-requests/loadTrip";
import {
  SettlementCard,
  TripAmounts,
  TripFlow,
  TripSummaryCard,
} from "@/features/travel-requests/TripSummary";
import { currentPendingForEmployee } from "@/lib/approvals";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";
import { settlementEditable } from "@/lib/settlement";
import type { TravelRequest } from "@/types/travelRequest";

export function TravelRequestDetailPage() {
  const { travelRequestId = "" } = useParams();
  const { employee, can } = useEmployee();
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the trip and, once it can have one, its settlement
  useEffect(() => {
    let cancelled = false;
    loadTripWithSettlement(travelRequestId)
      .then(({ trip, settlement: settlementRow }) => {
        if (cancelled) return;
        setRequest(trip);
        setSettlement(settlementRow);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load request"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [travelRequestId]);

  if (loading) {
    return <PageLoader />;
  }

  if (error && !request) {
    return <Alert tone="error">{error}</Alert>;
  }

  if (!request) return null;

  const isOwner = employee != null && request.employee_id === employee.id;
  const isDraft = request.status === "draft";
  // Requester can add / change expenses once the advance step is over, until the claim is submitted
  const canEditSettlement = settlementEditable(request, settlement, employee?.id);
  const showSettlement = canEditSettlement || (settlement != null && settlement.status !== "draft");

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

  // Approvers decide from the Approvals review page, not the requester's view
  if (!isOwner && (requestPending || settlementPending)) {
    return <Navigate to={paths.review(travelRequestId)} replace />;
  }
  // Finance acts from its own review page too
  if (!isOwner && can("release_funds") && financeTaskFor(request, settlement)) {
    return <Navigate to={paths.financeReview(travelRequestId)} replace />;
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader
        eyebrow="Travel request"
        title={request.travel_request_id}
        aside={
          <StatusBadge
            status={request.status}
            settlementStatus={settlement?.status}
          />
        }
      >
        {/* Policy reference */}
        <PolicyReference />
      </PageHeader>

      {/* Where the trip is in the overall flow, with who signs off level by level */}
      <TripFlow request={request} settlement={settlement} />

      {/* key figures (settlement outcome once a claim is filed) */}
      <TripAmounts
        request={request}
        settlement={settlement && settlement.status !== "draft" ? settlement : null}
      />

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

      {/* next step after approval: claim expenses on the settlement page */}
      {showSettlement ? (
        <SettlementCard
          settlement={settlement}
          to={paths.tripSettlement(request.travel_request_id)}
          editable={canEditSettlement}
        />
      ) : null}

      {/* summary card; the full form opens on its own page */}
      <TripSummaryCard request={request} to={paths.tripForm(request.travel_request_id)} />

      {isOwner && isDraft ? (
        <div className="flex justify-end">
          <LinkButton to={paths.tripEdit(request.travel_request_id)} variant="primary">
            Edit draft
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}
