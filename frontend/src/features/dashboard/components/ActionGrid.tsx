import { ActionTile } from "@/features/dashboard/components/ActionTile";
import type { DashboardAction } from "@/features/dashboard/config/actions";

interface ActionGridProps {
  actions: DashboardAction[];
}

export function ActionGrid({ actions }: ActionGridProps) {
  if (actions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-sm text-slate-500">
        No actions available for this role.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => (
        <ActionTile key={action.id} action={action} />
      ))}
    </div>
  );
}
