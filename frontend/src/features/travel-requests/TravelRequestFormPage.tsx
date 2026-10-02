import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getTravelRequest } from "@/api/travelRequests";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TravelRequestFormView } from "@/features/travel-requests/TravelRequestFormView";
import { errorMessage } from "@/lib/errors";
import type { TravelRequest } from "@/types/travelRequest";

export function TravelRequestFormPage() {
  const { travelRequestId = "" } = useParams();
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // load the submitted request
    getTravelRequest(travelRequestId)
      .then((trip) => {
        if (!cancelled) setRequest(trip);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load request"));
      });
    return () => {
      cancelled = true;
    };
  }, [travelRequestId]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!request) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader
        eyebrow="Travel request"
        title={request.travel_request_id}
        aside={<StatusBadge status={request.status} />}
      />
      <TravelRequestFormView request={request} />
    </div>
  );
}
