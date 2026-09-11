import { Link } from "react-router-dom";

import type { DashboardAction } from "@/features/dashboard/config/actions";

interface ActionTileProps {
  action: DashboardAction;
}

export function ActionTile({ action }: ActionTileProps) {
  return (
    <Link
      to={action.to}
      className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-700/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">
        {action.eyebrow}
      </p>
      <h2 className="mt-3 font-display text-xl text-teal-950 transition group-hover:text-teal-900">
        {action.title}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
        {action.description}
      </p>
      <span className="mt-5 text-sm font-medium text-teal-800">
        Open
        <span className="ml-1 inline-block transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
