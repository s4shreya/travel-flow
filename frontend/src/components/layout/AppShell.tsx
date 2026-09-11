import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { NotificationsDrawer } from "@/components/layout/NotificationsDrawer";
import { PersonaSwitcher } from "@/components/layout/PersonaSwitcher";
import { useEmployee } from "@/context/EmployeeContext";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { employee, setEmployeeCode } = useEmployee();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8f3f1_0%,_#f7faf9_45%,_#eef2f1_100%)] text-slate-900">
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
            <PersonaSwitcher employee={employee} onSelect={setEmployeeCode} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <NotificationsDrawer />
    </div>
  );
}
