import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { InfoTip } from "@/components/ui/InfoTip";

type Accent = "teal" | "amber" | "sky" | "emerald" | "rose";

const ACCENT_CLASS: Record<Accent, string> = {
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  emerald: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-700",
};

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  icon: LucideIcon;
  accent?: Accent;
  to?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  info,
  icon: Icon,
  accent = "teal",
  to,
  loading = false,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
          {label}
          {info ? <InfoTip text={info} /> : null}
        </p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASS[accent]}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {value}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  const className =
    "block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition";

  return to ? (
    <Link to={to} className={`${className} hover:border-slate-300 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
