import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { formatMoneyInput } from "@/lib/money";
import {
  BORNE_BY_OPTIONS,
  type BorneBy,
  type EstimatedHead,
} from "@/types/travelRequest";

interface EstimatedHeadsEditorProps {
  value: EstimatedHead[];
  error?: string;
  onChange: (heads: EstimatedHead[]) => void;
}

const EMPTY_HEAD: EstimatedHead = {
  head: "",
  basis: "",
  amount: "",
  borne_by: "Company",
};

const BORNE_BY_SELECT_OPTIONS = BORNE_BY_OPTIONS.map((option) => ({
  value: option,
  label: option,
}));

export function EstimatedHeadsEditor({
  value,
  error,
  onChange,
}: EstimatedHeadsEditorProps) {
  function updateRow(index: number, patch: Partial<EstimatedHead>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, { ...EMPTY_HEAD }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">
            Estimated Cost
            <span className="ml-0.5 text-red-700" aria-hidden>
              *
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Break down the estimate by head. Total is calculated automatically.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={addRow}>
          Add
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="rounded-t-xl grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_7rem_8rem_4.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          <span>Head</span>
          <span>Basis</span>
          <span>Estimate</span>
          <span>Borne by</span>
          <span className="sr-only">Actions</span>
        </div>

        <div className="divide-y divide-slate-100 overflow-visible">
          {value.map((row, index) => (
            <div
              key={`head-${index}`}
              className="relative grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_7rem_8rem_4.5rem] items-center gap-2 px-3 py-2.5"
            >
              <Input
                id={`head-name-${index}`}
                value={row.head}
                placeholder="e.g. Lodging"
                onChange={(event) =>
                  updateRow(index, { head: event.target.value })
                }
                aria-label={`Cost head ${index + 1} name`}
                required
              />
              <Input
                id={`head-basis-${index}`}
                value={row.basis}
                placeholder="e.g. 4 nights"
                onChange={(event) =>
                  updateRow(index, { basis: event.target.value })
                }
                aria-label={`Cost head ${index + 1} basis`}
                required
              />
              <Input
                id={`head-amount-${index}`}
                inputMode="decimal"
                className="text-right tabular-nums"
                value={row.amount}
                placeholder="0.00"
                onChange={(event) =>
                  updateRow(index, {
                    amount: formatMoneyInput(event.target.value),
                  })
                }
                aria-label={`Cost head ${index + 1} estimate`}
                required
              />
              <SelectMenu
                id={`head-borne-${index}`}
                value={row.borne_by}
                options={BORNE_BY_SELECT_OPTIONS}
                onChange={(next) =>
                  updateRow(index, { borne_by: next as BorneBy })
                }
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2"
                  onClick={() => removeRow(index)}
                  disabled={value.length <= 1}
                  aria-label={`Remove cost head ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
