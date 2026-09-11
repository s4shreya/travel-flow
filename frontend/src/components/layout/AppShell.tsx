import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { NotificationsDrawer } from "@/components/layout/NotificationsDrawer";
import { PersonaSwitcher } from "@/components/layout/PersonaSwitcher";
import { BackButton } from "@/components/ui/BackButton";
import { useEmployee } from "@/context/EmployeeContext";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { employee, employees, setEmployeeCode, loading, error } = useEmployee();
  const { pathname } = useLocation();
  const showBack = pathname !== "/";

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8f3f1_0%,_#f7faf9_45%,_#eef2f1_100%)] text-slate-900">
      <header className="w-full border-b border-teal-950/40 bg-gradient-to-r from-[#04343a] via-[#0a4f56] to-[#065f5b] text-teal-50 shadow-sm">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
          <div className="min-w-0 justify-self-start">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/75 sm:text-xs">
              Nortex Industries Ltd
            </p>
          </div>

          <Link
            to="/"
            className="justify-self-center font-display text-2xl tracking-tight text-white transition hover:text-teal-100 sm:text-[1.65rem]"
            aria-label="TravelFlow home"
          >
            TravelFlow
          </Link>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <NotificationsBell />
            {employee ? (
              <PersonaSwitcher
                employee={employee}
                employees={employees}
                onSelect={setEmployeeCode}
              />
            ) : (
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs text-teal-100">
                {loading ? "Loading…" : "No profile"}
              </span>
            )}
          </div>
        </div>
      </header>

      {showBack ? (
        <div className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-20 sm:top-24">
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="pointer-events-auto absolute left-4 top-0 sm:left-0 sm:-translate-x-[calc(100%+0.75rem)]">
              <BackButton />
            </div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {error ? (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}
        {children}
      </main>

      <NotificationsDrawer />
    </div>
  );
}
