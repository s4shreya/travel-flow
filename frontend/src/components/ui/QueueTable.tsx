import { ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { formatDate } from "@/lib/dates";
import { formatAmountValue } from "@/lib/money";

export interface QueueRow {
  key: string;
  travelRequestId: string;
  href: string;
  employee: string;
  destination: string;
  stage: string;
  stageHint: string;
  amount: string | number;
  submittedAt: string;
}

const th = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const td = "px-4 py-3 align-middle";

/** Work-queue table (Approvals, Finance); each row opens its review page. */
export function QueueTable({ rows, stageHeader = "Stage" }: { rows: QueueRow[]; stageHeader?: string }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className={th}>Request</th>
            <th className={th}>Employee</th>
            <th className={th}>{stageHeader}</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={th}>Submitted</th>
            <th className="w-10" aria-label="Open" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.key}
              onClick={() => navigate(row.href)}
              className="group cursor-pointer transition hover:bg-slate-50"
            >
              {/* request id (real link for keyboard users) */}
              <td className={td}>
                <Link
                  to={row.href}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-teal-700 hover:underline"
                >
                  {row.travelRequestId}
                </Link>
              </td>
              {/* who raised it and where to */}
              <td className={td}>
                <p className="font-medium text-slate-900">{row.employee}</p>
                <p className="text-xs text-slate-500">{row.destination}</p>
              </td>
              {/* what is pending, and on whom */}
              <td className={td}>
                <p className="font-medium text-slate-900">{row.stage}</p>
                <p className="text-xs text-slate-500">{row.stageHint}</p>
              </td>
              <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>
                ₹{formatAmountValue(row.amount)}
              </td>
              <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDate(row.submittedAt)}</td>
              <td className={`${td} text-slate-400 group-hover:text-slate-600`}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
