import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getTravelRequest } from "@/api/travelRequests";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { TravelRequestForm } from "@/features/travel-requests/TravelRequestForm";
import {
  valuesFromTravelRequest,
  type TravelRequestFormValues,
} from "@/features/travel-requests/formModel";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";

export function EditTravelRequestPage() {
  const { travelRequestId = "" } = useParams();
  const [initial, setInitial] = useState<TravelRequestFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTravelRequest(travelRequestId)
      .then((trip) => {
        if (cancelled) return;
        if (trip.status !== "draft") {
          setError("Only draft travel requests can be edited");
          return;
        }
        setInitial(valuesFromTravelRequest(trip));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to load draft"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [travelRequestId]);

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="error">{error}</Alert>
        <Link to={paths.trip(travelRequestId)} className="text-teal-800">
          Back to request
        </Link>
      </div>
    );
  }
  if (!initial) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit travel request">
        <p className="text-sm text-slate-600">{travelRequestId}</p>
      </PageHeader>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <TravelRequestForm editId={travelRequestId} initialValues={initial} />
      </div>
    </div>
  );
}
