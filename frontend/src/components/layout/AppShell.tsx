import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { BackButton } from "@/components/ui/BackButton";
import { useEmployee } from "@/context/EmployeeContext";
import { useNotifications } from "@/context/NotificationsContext";
import { paths } from "@/lib/routes";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { employee, logout } = useEmployee();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { refresh: refreshNotifications } = useNotifications();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const showBack = pathname !== paths.home;

  useEffect(() => {
    // Pick up new notifications on every page change
    void refreshNotifications();
  }, [pathname, refreshNotifications]);

  async function onSignOut() {
    await logout();
    navigate(paths.login, { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:flex">
        <Sidebar />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-slate-900/40 animate-fade"
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] animate-in">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          {showBack ? <BackButton /> : null}

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationsBell />
            <span aria-hidden className="hidden h-6 w-px bg-slate-200 sm:block" />
            {employee ? (
              <UserMenu employee={employee} onSignOut={() => void onSignOut()} />
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
