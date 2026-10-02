import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  listMyTravelRequests,
  type TravelRequestListItem,
} from "@/api/travelRequests";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PageLoader } from "@/components/ui/Loader";
import { useEmployee } from "@/context/EmployeeContext";
import { TrackRequestCard } from "@/features/travel-requests/TrackRequestCard";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";
import { tripOutcome } from "@/lib/tripProgress";

export function TrackTravelRequestsPage() {
  const { can } = useEmployee();
  const allowed = can("track_requests");
  const [rows, setRows] = useState<TravelRequestListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(allowed);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    listMyTravelRequests()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to load requests"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <Alert tone="error">You do not have access to track requests.</Alert>
    );
  }

  const active = rows.filter((row) => tripOutcome(row) === "active");
  const closed = rows.filter((row) => tripOutcome(row) !== "active");

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader eyebrow="Track" title="My Requests" />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <PageLoader /> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          No requests yet.{" "}
          <Link to={paths.claims} className="font-medium text-teal-800">
            Create one
          </Link>
          .
        </p>
      ) : null}

      {/* Open trips first, finished ones grouped below */}
      <RequestSection title="In progress" rows={active} />
      <RequestSection title="Closed" rows={closed} />
    </div>
  );
}

function RequestSection({
  title,
  rows,
}: {
  title: string;
  rows: TravelRequestListItem[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] tabular-nums text-slate-600">
          {rows.length}
        </span>
      </h2>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.travel_request_id}>
            <TrackRequestCard row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}
