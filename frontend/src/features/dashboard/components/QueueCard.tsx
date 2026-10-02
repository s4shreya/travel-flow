import { Link } from "react-router-dom";

import { formatAmountValue } from "@/lib/money";

export interface QueueCardItem {
  key: string;
  to: string;
  title: string;
  subtitle: string;
  amount: string | number;
}

const PREVIEW_LIMIT = 4;

/** Dashboard side card previewing a work queue (approvals, Finance). */
export function QueueCard({
  title,
  items,
  loading,
}: {
  title: string;
  items: QueueCardItem[];
  loading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
          {loading ? "…" : items.length}
        </span>
      </div>
      {!loading && items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">You're all caught up.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, PREVIEW_LIMIT).map((item) => (
            <li key={item.key}>
              <Link to={item.to} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.subtitle}</p>
                </div>
                <p className="text-sm font-medium text-slate-900 tabular-nums">
                  ₹{formatAmountValue(item.amount)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
