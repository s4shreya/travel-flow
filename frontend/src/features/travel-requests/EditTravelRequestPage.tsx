import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getTravelRequest } from "@/api/travelRequests";
import { Alert } from "@/components/ui/Alert";
import { useEmployee } from "@/context/EmployeeContext";
import { TravelRequestForm } from "@/features/travel-requests/TravelRequestForm";
import {
  valuesFromTravelRequest,
  type TravelRequestFormValues,
} from "@/features/travel-requests/formModel";

export function EditTravelRequestPage() {
  const { travelRequestId = "" } = useParams();
  const { employeeCode } = useEmployee();
  const [initial, setInitial] = useState<TravelRequestFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTravelRequest(employeeCode, travelRequestId)
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
          setError(err instanceof Error ? err.message : "Failed to load draft");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeCode, travelRequestId]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="error">{error}</Alert>
        <Link to={`/travel-requests/${travelRequestId}`} className="text-teal-800">
          Back to request
        </Link>
      </div>
    );
  }
  if (!initial) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-teal-950 sm:text-4xl">
          Edit travel request
        </h1>
        <p className="mt-1 text-sm text-slate-600">{travelRequestId}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <TravelRequestForm editId={travelRequestId} initialValues={initial} />
      </div>
    </div>
  );
}
