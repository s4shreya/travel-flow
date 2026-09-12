import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectMenuProps {
  id: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const triggerClass =
  "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-900 outline-none transition hover:border-teal-700/50 focus-visible:border-teal-700 focus-visible:ring-2 focus-visible:ring-teal-700/20 disabled:cursor-not-allowed disabled:bg-slate-50";

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

export function SelectMenu({
  id,
  value,
  options,
  placeholder = "Select…",
  disabled = false,
  onChange,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  function updateMenuPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const preferred = 240;
    const openUp = spaceBelow < Math.min(preferred, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.min(preferred, openUp ? spaceAbove : spaceBelow);
    setMenuPos({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(maxHeight, 120),
      openUp,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    // Capture scroll from nested overflow containers (settlement tables)
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={triggerClass}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={selected ? "truncate" : "truncate text-slate-400"}>
          {selected?.label ?? placeholder}
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && menuPos
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={id}
              className="fixed z-[200] overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in"
              style={{
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight,
                ...(menuPos.openUp
                  ? { bottom: window.innerHeight - menuPos.top }
                  : { top: menuPos.top }),
              }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition",
                        isSelected
                          ? "bg-teal-50 font-medium text-teal-950"
                          : "text-slate-800 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected ? (
                        <span className="ml-2 text-teal-800" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
