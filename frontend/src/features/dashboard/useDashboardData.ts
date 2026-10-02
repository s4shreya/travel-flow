import { useEffect, useState } from "react";

import { fetchApprovalInbox, type ApprovalInboxItem } from "@/api/approvals";
import { fetchAdvancesQueue, fetchSettlementPaymentsQueue } from "@/api/finance";
import { fetchReport, type ReportResponse } from "@/api/reports";
import { listMyTravelRequests, type TravelRequestListItem } from "@/api/travelRequests";
import { useEmployee } from "@/context/EmployeeContext";

export interface DashboardData {
  myRequests: TravelRequestListItem[];
  approvals: ApprovalInboxItem[];
  advancesQueue: TravelRequestListItem[];
  paymentsQueue: TravelRequestListItem[];
  /** Organisation report (Finance / Admin only). */
  report: ReportResponse | null;
}

const EMPTY: DashboardData = {
  myRequests: [],
  approvals: [],
  advancesQueue: [],
  paymentsQueue: [],
  report: null,
};

/** Load only the datasets the signed-in role can access, in parallel. */
export function useDashboardData() {
  const { can } = useEmployee();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const none = Promise.resolve([]);

    Promise.allSettled([
      can("track_requests") ? listMyTravelRequests() : none,
      can("approve_requests") ? fetchApprovalInbox() : none,
      can("release_funds") ? fetchAdvancesQueue() : none,
      can("release_funds") ? fetchSettlementPaymentsQueue() : none,
      can("view_reports") ? fetchReport() : Promise.resolve(null),
    ]).then(([mine, inbox, advances, payments, report]) => {
      if (cancelled) return;
      // Keep partial data if one widget fails
      const pick = <T,>(result: PromiseSettledResult<T[]>): T[] =>
        result.status === "fulfilled" ? result.value : [];
      setData({
        myRequests: pick(mine as PromiseSettledResult<TravelRequestListItem[]>),
        approvals: pick(inbox as PromiseSettledResult<ApprovalInboxItem[]>),
        advancesQueue: pick(advances as PromiseSettledResult<TravelRequestListItem[]>),
        paymentsQueue: pick(payments as PromiseSettledResult<TravelRequestListItem[]>),
        report: report.status === "fulfilled" ? report.value : null,
      });
      const failed = [mine, inbox, advances, payments, report].some(
        (result) => result.status === "rejected",
      );
      setError(failed ? "Some dashboard data could not be loaded." : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [can]);

  return { data, loading, error };
}
