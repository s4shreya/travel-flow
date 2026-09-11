import { useEffect, useId, useMemo, useRef, useState } from "react";

interface DatePickerProps {
  id: string;
  value: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseIso(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value: string): string {
  const date = parseIso(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBeforeDay(a: Date, b: Date): boolean {
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return aa < bb;
}

function isAfterDay(a: Date, b: Date): boolean {
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return aa > bb;
}

export function DatePicker({
  id,
  value,
  min,
  max,
  placeholder = "Select date",
  disabled = false,
  onChange,
}: DatePickerProps) {
  const selected = parseIso(value);
  const minDate = parseIso(min ?? "");
  const maxDate = parseIso(max ?? "");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(
    () => startOfMonth(selected ?? new Date()),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (selected) setCursor(startOfMonth(selected));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- sync month when value changes

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const startOffset = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [cursor]);

  const today = new Date();

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm outline-none transition hover:border-teal-700/50 focus-visible:border-teal-700 focus-visible:ring-2 focus-visible:ring-teal-700/20 disabled:cursor-not-allowed disabled:bg-slate-50"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-900"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <span className={selected ? "truncate text-slate-900" : "truncate text-slate-400"}>
            {selected ? formatDisplay(value) : placeholder}
          </span>
        </span>
        <span aria-hidden className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose date"
          className="absolute z-40 mt-1.5 w-[19.5rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg animate-in"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
              onClick={() => setCursor((prev) => addMonths(prev, -1))}
            >
              ‹
            </button>
            <p className="font-display text-sm text-teal-950">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </p>
            <button
              type="button"
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
              onClick={() => setCursor((prev) => addMonths(prev, 1))}
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const iso = toIso(day);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, today);
              const outOfRange =
                (minDate && isBeforeDay(day, minDate)) ||
                (maxDate && isAfterDay(day, maxDate));

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={Boolean(outOfRange)}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={[
                    "flex h-9 items-center justify-center rounded-lg text-sm transition",
                    !inMonth ? "text-slate-300" : "text-slate-800",
                    outOfRange
                      ? "cursor-not-allowed opacity-30"
                      : "hover:bg-teal-50",
                    isSelected
                      ? "bg-teal-900 font-semibold text-white hover:bg-teal-900"
                      : "",
                    !isSelected && isToday ? "ring-1 ring-teal-700/40" : "",
                  ].join(" ")}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              className="text-xs font-medium text-teal-800 hover:text-teal-950"
              onClick={() => {
                const now = toIso(new Date());
                if (minDate && isBeforeDay(new Date(), minDate)) return;
                if (maxDate && isAfterDay(new Date(), maxDate)) return;
                onChange(now);
                setOpen(false);
              }}
            >
              Today
            </button>
            {value ? (
              <button
                type="button"
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
