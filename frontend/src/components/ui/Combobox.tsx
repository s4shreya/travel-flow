import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/Field";

export interface ComboboxOption {
  value: string;
  /** Secondary text on the right, e.g. the state of a city. */
  hint?: string;
}

interface ComboboxProps {
  id: string;
  value: string;
  options: ComboboxOption[];
  placeholder?: string;
  maxLength?: number;
  onChange: (value: string) => void;
}

// Render at most this many matches; typing narrows the rest
const MAX_RESULTS = 50;

/** Search-as-you-type input with a suggestion list; free text is still allowed. */
export function Combobox({
  id,
  value,
  options,
  placeholder,
  maxLength,
  onChange,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  // null = show every option (just focused); string = filter by what was typed
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  // matches that start with the query first, then ones that contain it
  const matches = useMemo(() => {
    const term = query?.trim().toLowerCase();
    if (!term) return options.slice(0, MAX_RESULTS);
    const starts: ComboboxOption[] = [];
    const contains: ComboboxOption[] = [];
    for (const option of options) {
      const name = option.value.toLowerCase();
      if (name.startsWith(term)) starts.push(option);
      else if (name.includes(term)) contains.push(option);
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [options, query]);

  const showList = open && matches.length > 0;

  // keep the highlighted option visible while using the arrow keys
  useEffect(() => {
    if (!showList) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, showList]);

  function openList(nextQuery: string | null) {
    setQuery(nextQuery);
    setActive(0);
    setOpen(true);
  }

  function pick(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!showList) return openList(null);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((prev) => (prev + step + matches.length) % matches.length);
    } else if (event.key === "Enter" && showList) {
      // pick the highlighted city instead of submitting the form
      event.preventDefault();
      pick(matches[active]);
    } else if (event.key === "Escape" && open) {
      // Close only the list, not a modal around it
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        onFocus={(event) => {
          event.target.select();
          openList(null);
        }}
        onClick={() => !open && openList(null)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          openList(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      {showList ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.map((option, index) => (
            <li
              key={`${option.value}|${option.hint ?? ""}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={[
                "flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm",
                index === active ? "bg-teal-50 text-teal-950" : "text-slate-800",
              ].join(" ")}
              // mousedown + preventDefault keeps focus in the input until the pick lands
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="truncate">{option.value}</span>
              {option.hint ? (
                <span className="shrink-0 text-xs text-slate-400">{option.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
