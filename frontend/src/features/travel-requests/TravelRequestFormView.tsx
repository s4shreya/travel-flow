import { Field, Input, TextArea } from "@/components/ui/Field";
import { formatAmountValue } from "@/lib/money";
import type { TravelRequest } from "@/types/travelRequest";

interface TravelRequestFormViewProps {
  request: TravelRequest;
}

/**
 * Read-only travel request form layout for approvers (and anyone viewing a submitted request).
 */
export function TravelRequestFormView({ request }: TravelRequestFormViewProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold text-slate-800">
        Travel request form
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Submitted details (read-only).
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="view-start" label="From date">
          <Input id="view-start" value={request.start_date} readOnly disabled />
        </Field>
        <Field id="view-end" label="To date">
          <Input id="view-end" value={request.end_date} readOnly disabled />
        </Field>
        <Field id="view-destination" label="Destination">
          <Input
            id="view-destination"
            value={request.destination}
            readOnly
            disabled
          />
        </Field>
        <Field id="view-currency" label="Currency">
          <Input id="view-currency" value={request.currency} readOnly disabled />
        </Field>
        <Field id="view-category" label="Travel category">
          <Input
            id="view-category"
            value={request.travel_category}
            readOnly
            disabled
          />
        </Field>
        <Field id="view-mode" label="Travel mode">
          <Input
            id="view-mode"
            value={request.travel_mode}
            readOnly
            disabled
          />
        </Field>
        <Field id="view-estimate" label="Estimated cost (₹)">
          <Input
            id="view-estimate"
            value={formatAmountValue(request.estimated_cost)}
            readOnly
            disabled
          />
        </Field>
        <Field id="view-advance" label="Advance requested (₹)">
          <Input
            id="view-advance"
            value={formatAmountValue(request.advance_requested)}
            readOnly
            disabled
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="view-purpose" label="Purpose">
            <TextArea
              id="view-purpose"
              value={request.purpose}
              readOnly
              disabled
            />
          </Field>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-slate-800">
        Estimated cost heads
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">Head</th>
              <th className="px-2 py-2">Basis</th>
              <th className="px-2 py-2">Borne by</th>
              <th className="px-2 py-2 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {request.estimated_heads.map((head, index) => (
              <tr key={`${head.head}-${index}`}>
                <td className="px-2 py-2 text-slate-900">{head.head}</td>
                <td className="px-2 py-2 text-slate-600">{head.basis}</td>
                <td className="px-2 py-2 text-slate-600">{head.borne_by}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                  {formatAmountValue(head.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Number(request.advance_disbursed) > 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          Advance released: ₹{formatAmountValue(request.advance_disbursed)}
        </p>
      ) : null}
    </section>
  );
}
