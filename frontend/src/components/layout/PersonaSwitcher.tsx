import { useEffect, useId, useRef, useState } from "react";

import type { EmployeeSummary } from "@/types/me";

interface PersonaSwitcherProps {
  employee: EmployeeSummary;
  employees: EmployeeSummary[];
  onSelect: (employeeCode: string) => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PersonaSwitcher({
  employee,
  employees,
  onSelect,
}: PersonaSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex max-w-full items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-teal-700/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/25"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-900 text-xs font-semibold tracking-wide text-white"
        >
          {initials(employee.name)}
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {employee.name}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {employee.role}
          </span>
        </span>
        <span
          aria-hidden
          className={`ml-1 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Switch demo employee"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-in"
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
              Demo profile
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Switch roles to preview each workspace
            </p>
          </div>

          <ul className="max-h-80 overflow-y-auto py-1">
            {employees.map((person) => {
              const selected = person.employee_code === employee.employee_code;
              return (
                <li key={person.employee_code} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(person.employee_code);
                      setOpen(false);
                    }}
                    className={[
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left transition",
                      selected ? "bg-teal-50" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden
                      className={[
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide",
                        selected
                          ? "bg-teal-900 text-white"
                          : "bg-slate-100 text-slate-700",
                      ].join(" ")}
                    >
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {person.name}
                        </span>
                        {selected ? (
                          <span className="shrink-0 text-xs font-medium text-teal-800">
                            Active
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {person.role} · {person.department}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                        {person.employee_code}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
