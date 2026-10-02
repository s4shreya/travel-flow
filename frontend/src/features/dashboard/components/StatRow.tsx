import { StatCard, type StatCardProps } from "@/features/dashboard/components/StatCard";

export type StatTile = StatCardProps & { id: string };

export function StatRow({ label, tiles, loading }: { label: string; tiles: StatTile[]; loading: boolean }) {
  if (tiles.length === 0) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ id, ...stat }) => (
          <StatCard key={id} {...stat} loading={loading} />
        ))}
      </div>
    </section>
  );
}
