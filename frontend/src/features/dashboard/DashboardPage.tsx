import { useMemo } from "react";

import { useEmployee } from "@/context/EmployeeContext";
import { ActionGrid } from "@/features/dashboard/components/ActionGrid";
import { DASHBOARD_ACTIONS } from "@/features/dashboard/config/actions";

export function DashboardPage() {
  const { employee, can } = useEmployee();

  const actions = useMemo(
    () =>
      DASHBOARD_ACTIONS.filter(
        (action) => !action.capability || can(action.capability)
      ),
    [can]
  );

  return (
    <div className="flex flex-col gap-8 animate-in">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl text-teal-950 sm:text-4xl">
          Welcome back, {employee.name.split(" ")[0]}
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
          {employee.designation} · {employee.department} · {employee.role}
        </p>
      </header>

      <section
        aria-labelledby="workspace-heading"
        className="flex flex-col gap-4 py-4"
      >
        <ActionGrid actions={actions} />
      </section>
    </div>
  );
}
