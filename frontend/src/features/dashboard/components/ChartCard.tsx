import type { ReactNode } from "react";

import { InfoTip } from "@/components/ui/InfoTip";

interface ChartCardProps {
  title: string;
  subtitle: string;
  info?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/** Card frame shared by the dashboard charts. */
export function ChartCard({ title, subtitle, info, footer, children }: ChartCardProps) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          {title}
          {info ? <InfoTip text={info} /> : null}
        </h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="h-64 px-2 pb-2 pt-4">{children}</div>
      {footer ? (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">{footer}</p>
      ) : null}
    </section>
  );
}
