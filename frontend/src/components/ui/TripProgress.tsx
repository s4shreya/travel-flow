import {
  Banknote,
  Check,
  FileText,
  Receipt,
  ShieldCheck,
  UserCheck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  tripPercent,
  tripSteps,
  type StepKey,
  type StepState,
  type TripProgressInput,
  type TripStep,
} from "@/lib/tripProgress";

type TripProgressProps = Partial<TripProgressInput> & {
  /** "full" = labelled stepper (detail / create), "compact" = card summary (lists). */
  variant?: "full" | "compact";
  /** Show fixed steps instead of computing them, e.g. the create-form preview. */
  steps?: TripStep[];
  title?: string;
  /** Hide "Step x of 6 · %" and the bar (used for the preview). */
  hideSummary?: boolean;
  /** "all" = text under every step, "active" = only under the current / rejected step. */
  captions?: "all" | "active";
  /** Extra content at the bottom of the card, e.g. the approval chain. */
  children?: ReactNode;
};

// Outline icon per step
const STEP_ICON: Record<StepKey, LucideIcon> = {
  request: FileText,
  approval: UserCheck,
  advance: Wallet,
  claim: Receipt,
  review: ShieldCheck,
  payment: Banknote,
};

const DOT_CLASS: Record<StepState, string> = {
  done: "border-teal-700 bg-teal-700 text-white",
  current: "border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-700/30",
  rejected: "border-red-600 bg-red-600 text-white",
  upcoming: "border-slate-200 bg-slate-50 text-slate-500",
};

const TITLE_CLASS: Record<StepState, string> = {
  done: "text-slate-800",
  current: "text-teal-700",
  rejected: "text-red-700",
  upcoming: "text-slate-800",
};

const CAPTION_CLASS: Record<StepState, string> = {
  done: "text-slate-500",
  current: "font-medium text-teal-700",
  rejected: "font-medium text-red-600",
  upcoming: "text-slate-500",
};

/** Icon inside the step circle: tick when done, cross when rejected. */
function StepGlyph({ step, className }: { step: TripStep; className?: string }) {
  const Glyph =
    step.state === "done" ? Check : step.state === "rejected" ? X : STEP_ICON[step.key];
  return <Glyph className={className} strokeWidth={1.8} aria-hidden />;
}

/** Connector colour between a step and the one before it. */
function connectorClass(step: TripStep): string {
  if (step.state === "upcoming") return "bg-slate-200";
  if (step.state === "rejected") return "bg-red-300";
  return "bg-teal-600";
}

/** Circular percentage ring for the compact card. */
function ProgressRing({ percent, tone }: { percent: number; tone: "teal" | "red" }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="4" className="stroke-slate-200" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className={`animate-ring transition-[stroke-dashoffset] duration-700 ${tone === "red" ? "stroke-red-500" : "stroke-teal-600"}`}
          style={{ ["--ring-from" as string]: circumference }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-800">
        {percent}%
      </span>
    </div>
  );
}

export function TripProgress({
  variant = "full",
  steps: fixedSteps,
  title = "Trip progress",
  hideSummary = false,
  captions = "all",
  children,
  ...input
}: TripProgressProps) {
  const steps =
    fixedSteps ??
    tripSteps({
      status: input.status ?? "draft",
      advance_requested: input.advance_requested ?? 0,
      advance_disbursed: input.advance_disbursed ?? 0,
      settlement_status: input.settlement_status,
      pending_with: input.pending_with,
    });
  const percent = tripPercent(steps);
  const activeIndex = steps.findIndex(
    (step) => step.state === "current" || step.state === "rejected",
  );
  const active = activeIndex >= 0 ? steps[activeIndex] : null;
  const complete = activeIndex < 0;
  const rejected = active?.state === "rejected";
  const next = !complete && !rejected ? steps[activeIndex + 1] : undefined;

  // Headline: "Step 3 of 6 · Advance disbursement" or "All steps completed"
  const summary = complete
    ? "All steps completed"
    : `Step ${activeIndex + 1} of ${steps.length} · ${active?.label}`;

  if (variant === "compact") {
    return (
      <div
        className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:gap-5"
        aria-label={`Trip progress: ${summary}`}
      >
        {/* Ring + where it is now */}
        <div className="flex min-w-0 items-center gap-3 sm:w-64 sm:shrink-0">
          <ProgressRing percent={percent} tone={rejected ? "red" : "teal"} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {complete ? "Completed" : `Step ${activeIndex + 1} of ${steps.length}`}
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {complete ? "All steps completed" : active?.label}
            </p>
            {active?.caption ? (
              <p className={`truncate text-xs ${rejected ? "text-red-600" : "text-amber-700"}`}>
                {active.caption}
              </p>
            ) : complete ? (
              <p className="text-xs text-teal-700">Paid & closed</p>
            ) : null}
            {next ? (
              <p className="truncate text-xs text-slate-500">Next: {next.label}</p>
            ) : null}
          </div>
        </div>

        {/* Mini stepper with step names below and hover details */}
        <ol className="flex flex-1 items-center pb-5">
          {steps.map((step, index) => (
            <li key={step.key} className={`flex items-center ${index > 0 ? "flex-1" : ""}`}>
              {index > 0 ? (
                <span aria-hidden className={`mx-1 h-0.5 flex-1 rounded-full transition-colors duration-500 ${connectorClass(step)}`} />
              ) : null}
              <span className="group/step relative flex">
                <span
                  className={`relative flex size-7 items-center justify-center rounded-full border transition-transform duration-200 group-hover/step:scale-110 ${DOT_CLASS[step.state]}`}
                >
                  {step.state === "current" ? (
                    <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-teal-500/30" />
                  ) : null}
                  <StepGlyph step={step} className="relative size-3.5" />
                </span>
                {/* Step name under the icon */}
                <span
                  className={`absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none ${CAPTION_CLASS[step.state]}`}
                >
                  {step.shortLabel}
                </span>
                {/* Tooltip */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-48 -translate-x-1/2 translate-y-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-center text-[11px] leading-snug text-white opacity-0 shadow-lg transition duration-150 group-hover/step:translate-y-0 group-hover/step:opacity-100"
                >
                  <span className="block font-semibold">{step.label}</span>
                  <span className="block text-slate-300">{step.caption ?? step.description}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5"
      aria-label={title}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h2>
        {!hideSummary ? (
          <p className="text-xs text-slate-500">
            {summary}
            {active?.caption ? ` — ${active.caption}` : ""} ·{" "}
            <span className="tabular-nums font-semibold text-slate-800">{percent}%</span>
          </p>
        ) : null}
      </div>

      {/* Overall bar (grows in on load) */}
      {!hideSummary ? (
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`animate-progress h-full origin-left rounded-full transition-[width] duration-700 ${rejected ? "bg-red-500" : "bg-teal-600"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      <div className="-mx-1 mt-3 overflow-x-auto px-1 pb-1 pt-3">
        <ol className="grid min-w-160 grid-cols-6">
          {steps.map((step, index) => (
            <li
              key={step.key}
              className="group relative flex flex-col items-center px-1 text-center"
              aria-current={step.state === "current" ? "step" : undefined}
            >
              {/* connector to the previous step */}
              {index > 0 ? (
                <span
                  aria-hidden
                  className={`absolute right-[calc(50%+1.5rem)] top-4.5 h-0.5 w-[calc(100%-3rem)] rounded-full transition-colors duration-500 ${connectorClass(step)}`}
                />
              ) : null}
              <span
                className={`relative z-10 flex size-9 items-center justify-center rounded-full border transition-transform duration-200 group-hover:scale-110 ${DOT_CLASS[step.state]}`}
              >
                {step.state === "current" ? (
                  <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-teal-500/25" />
                ) : null}
                <StepGlyph step={step} className="relative size-4.5" />
              </span>
              <span className={`mt-2 text-[13px] font-semibold leading-tight ${TITLE_CLASS[step.state]}`}>
                {step.label}
              </span>
              {captions === "all" || step.state === "current" || step.state === "rejected" ? (
                <span className={`mt-0.5 text-xs leading-snug ${CAPTION_CLASS[step.state]}`}>
                  {step.caption ?? step.description}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {children ? <div className="mt-4 flex flex-col gap-3">{children}</div> : null}
    </section>
  );
}
