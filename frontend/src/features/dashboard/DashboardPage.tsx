import { useMemo } from "react";

import { useEmployee } from "@/context/EmployeeContext";
import { ActionGrid } from "@/features/dashboard/components/ActionGrid";
import { DASHBOARD_ACTIONS } from "@/features/dashboard/config/actions";

export function DashboardPage() {
  const { employee, can, loading } = useEmployee();

  const actions = useMemo(
    () =>
      DASHBOARD_ACTIONS.filter(
        (action) => !action.capability || can(action.capability)
      ),
    [can]
  );

  const firstName = employee?.name.split(" ")[0] ?? "there";

  if (loading && !employee) {
    return <p className="text-sm text-slate-500">Loading workspace…</p>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl text-teal-950 sm:text-4xl">
          Welcome back, {firstName}
        </h1>
        {employee ? (
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            {employee.designation} · {employee.department} · {employee.role}
          </p>
        ) : null}
      </header>

      <section
        aria-labelledby="workspace-heading"
        className="flex flex-col py-4"
      >
        <ActionGrid actions={actions} />
      </section>
    </div>
  );
}
