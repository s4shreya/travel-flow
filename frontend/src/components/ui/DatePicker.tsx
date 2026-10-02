import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  floatingStyle,
  useFloatingPosition,
} from "@/hooks/useFloatingPosition";
import { formatDate, parseIso, toIso, todayIso } from "@/lib/dates";

// Calendar panel size (19.5rem wide; header + 6 week rows + footer)
const PANEL_WIDTH = 312;
const PANEL_HEIGHT = 380;

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

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** YYYY-MM-DD strings compare correctly as text. */
function outOfRange(iso: string, min?: string, max?: string): boolean {
  return Boolean((min && iso < min) || (max && iso > max));
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
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(() =>
    startOfMonth(selected ?? new Date()),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // Portal + fixed position so modals (settlement expense editor) never clip the calendar
  const panelPos = useFloatingPosition(triggerRef, open, {
    preferredHeight: PANEL_HEIGHT,
    width: PANEL_WIDTH,
  });

  // Opening jumps to the selected month
  function toggle() {
    if (!open && selected) setCursor(startOfMonth(selected));
    setOpen(!open);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Close only the picker, not a modal around it
      event.stopPropagation();
      setOpen(false);
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

  const today = todayIso();
  const todayAllowed = !outOfRange(today, min, max);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm outline-none transition hover:border-teal-700/50 focus-visible:border-teal-700 focus-visible:ring-2 focus-visible:ring-teal-700/20 disabled:cursor-not-allowed disabled:bg-slate-50"
        onClick={toggle}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-900"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <span
            className={
              selected ? "truncate text-slate-900" : "truncate text-slate-400"
            }
          >
            {selected ? formatDate(value) : placeholder}
          </span>
        </span>
        <span
          aria-hidden
          className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && panelPos
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Choose date"
              className="fixed z-200 overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg animate-in"
              style={floatingStyle(panelPos)}
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
                  const isSelected = iso === value;
                  const isToday = iso === today;
                  const disabledDay = outOfRange(iso, min, max);

                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabledDay}
                      onClick={() => {
                        onChange(iso);
                        setOpen(false);
                      }}
                      className={[
                        "flex h-9 items-center justify-center rounded-lg text-sm transition",
                        !inMonth ? "text-slate-300" : "text-slate-800",
                        disabledDay
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
              title={todayAllowed ? "Pick today" : "Today is outside the allowed dates"}
              onClick={() => {
                // always jump to this month; pick today only when it is allowed
                setCursor(startOfMonth(new Date()));
                if (!todayAllowed) return;
                onChange(today);
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
