import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Shown in place of the body when there are no rows. */
  empty?: string;
}

const th = "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const td = "px-4 py-3 align-middle";

/** Read-only table (reports, directories). */
export function DataTable<T>({ columns, rows, rowKey, empty = "No records." }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={`${th} ${col.align === "right" ? "text-right" : "text-left"}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="transition hover:bg-slate-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${td} ${col.align === "right" ? "text-right tabular-nums" : ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
