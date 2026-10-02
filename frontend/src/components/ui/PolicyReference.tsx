import { FileText, ShieldCheck } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router-dom";

import {
  POLICY,
  policySectionHref,
  type PolicyRule,
} from "@/config/policy";

interface PolicyReferenceProps {
  /** Rules this screen checks; omit to show only the document link. */
  rules?: PolicyRule[];
}

/** "Checked against N policy rules · [Travel & Expense Policy]" — opens in a new tab so form input is kept. */
export function PolicyReference({ rules = [] }: PolicyReferenceProps) {
  const listId = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
      {rules.length > 0 ? (
        <div className="group/rules relative">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md py-0.5 underline-offset-4 transition hover:text-slate-800 hover:underline focus-visible:text-slate-800 focus-visible:outline-none"
            aria-describedby={listId}
          >
            <ShieldCheck className="size-4" strokeWidth={1.8} aria-hidden />
            Checked against {rules.length} policy rules
          </button>

          {/* Rule list on hover / keyboard focus */}
          <div
            id={listId}
            role="tooltip"
            className="invisible absolute left-0 top-full z-30 mt-2 w-80 translate-y-1 rounded-lg border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition duration-150 group-focus-within/rules:visible group-focus-within/rules:translate-y-0 group-focus-within/rules:opacity-100 group-hover/rules:visible group-hover/rules:translate-y-0 group-hover/rules:opacity-100"
          >
            <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {POLICY.docId} rules applied
            </p>
            <ul>
              {rules.map((rule) => (
                <li key={rule.label}>
                  <Link
                    to={policySectionHref(rule.section)}
                    target="_blank"
                    rel="noopener"
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] text-slate-700 hover:bg-teal-50 hover:text-teal-900"
                  >
                    <span className="mt-px shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                      §{rule.section}
                    </span>
                    {rule.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Link
        to={POLICY.path}
        target="_blank"
        rel="noopener"
        title={`${POLICY.docId} · ${POLICY.revision} · Effective ${POLICY.effective}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-700/40 hover:text-teal-900"
      >
        <FileText className="size-3.5" strokeWidth={1.8} aria-hidden />
        {POLICY.title}
        <span className="text-slate-400">· {POLICY.docId}</span>
      </Link>
    </div>
  );
}
