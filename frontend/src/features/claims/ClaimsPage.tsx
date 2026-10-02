import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { CLAIM_TYPES, claimPath } from "@/features/claims/claimTypes";
import { previewSteps } from "@/lib/tripProgress";

// Same flow for every travel claim: first two steps, "+N steps", last step
const STEPS = previewSteps();
const STEP_TRAIL = [
  STEPS[0].label,
  STEPS[1].label,
  `+${STEPS.length - 3} steps`,
  STEPS[STEPS.length - 1].label,
];

export function ClaimsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Raise a request">
        <p className="text-sm text-slate-600">
          Pick a category. Its form, approvers and policy checks follow from it.
        </p>
      </PageHeader>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CLAIM_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <li key={type.slug}>
              <Link
                to={claimPath(type)}
                className="group flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-700/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                {/* icon, title and description */}
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 group-hover:underline">
                      {type.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{type.description}</p>
                  </div>
                </div>

                {/* steps this claim goes through */}
                <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  {STEP_TRAIL.map((step, index) => (
                    <li key={step} className="flex items-center gap-1">
                      {index > 0 ? (
                        <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden />
                      ) : null}
                      {step}
                    </li>
                  ))}
                </ol>

                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">{STEPS.length} steps</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                    Start
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
