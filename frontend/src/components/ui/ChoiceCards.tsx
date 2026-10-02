import type { LucideIcon } from "lucide-react";

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: LucideIcon;
}

interface ChoiceCardsProps<T extends string> {
  name: string;
  /** Accessible name of the group. */
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
}

/** Radio group drawn as selectable cards (one column per choice). */
export function ChoiceCards<T extends string>({ name, label, value, choices, onChange }: ChoiceCardsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
    >
      {choices.map((choice) => {
        const Icon = choice.icon;
        const selected = value === choice.value;
        return (
          <label
            key={choice.value}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-700/30 ${
              selected ? "border-teal-700 bg-teal-50/60 ring-1 ring-teal-700" : "border-slate-300 hover:border-slate-400"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={selected}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            {Icon ? (
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-teal-700" : "text-slate-400"}`} aria-hidden />
            ) : null}
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{choice.label}</span>
              {choice.hint ? <span className="block text-xs text-slate-500">{choice.hint}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
