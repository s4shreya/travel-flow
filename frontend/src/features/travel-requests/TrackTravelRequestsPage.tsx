import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  listMyTravelRequests,
  type TravelRequestListItem,
} from "@/api/travelRequests";
import { Alert } from "@/components/ui/Alert";
import { useEmployee } from "@/context/EmployeeContext";
import { formatAmountValue } from "@/lib/money";
import { formatRequestStatus } from "@/lib/statusLabels";

export function TrackTravelRequestsPage() {
  const { employeeCode, can } = useEmployee();
  const [rows, setRows] = useState<TravelRequestListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!can("track_requests")) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listMyTravelRequests(employeeCode)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load requests",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeCode, can]);

  if (!can("track_requests")) {
    return (
      <Alert tone="error">You do not have access to track requests.</Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
          Track
        </p>
        <h1 className="font-display mt-2 text-3xl text-teal-950">
          Travel requests
        </h1>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          No requests yet.{" "}
          <Link to="/travel-requests/new" className="font-medium text-teal-800">
            Create one
          </Link>
          .
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.travel_request_id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {row.travel_request_id}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {row.destination} · {row.start_date} → {row.end_date}
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900">
                {formatRequestStatus(row.status)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Estimate ₹{formatAmountValue(row.estimated_cost)} · Advance ₹
              {formatAmountValue(row.advance_disbursed)}/
              {formatAmountValue(row.advance_requested)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
