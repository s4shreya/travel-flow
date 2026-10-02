import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BookOpen,
  ChevronDown,
  FileText,
  Lightbulb,
  Receipt,
  Search,
  ShieldCheck,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { LinkButton } from "@/components/ui/LinkButton";
import { POLICY, policySectionHref } from "@/config/policy";
import { useEmployee } from "@/context/EmployeeContext";
import { FAQS, GUIDE_GROUPS, JOURNEY, type Faq, type Guide } from "@/features/help/helpContent";
import { previewSteps, type StepKey } from "@/lib/tripProgress";

// Same step icons as the trip progress card
const STEP_ICON: Record<StepKey, LucideIcon> = {
  request: FileText,
  approval: UserCheck,
  advance: Wallet,
  claim: Receipt,
  review: ShieldCheck,
  payment: Banknote,
};

const STEPS = previewSteps();

/** Lower-case text match used by the search box. */
function matches(query: string, ...parts: string[]): boolean {
  return parts.join(" ").toLowerCase().includes(query);
}

function PolicyLink({ section }: { section: string }) {
  return (
    <Link
      to={policySectionHref(section)}
      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden />
      Policy §{section}
    </Link>
  );
}

/** Click through the six steps of a trip: who acts and what happens at each. */
function JourneyExplorer() {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const detail = JOURNEY[step.key];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">How a trip works, step by step</h2>
        <p className="text-xs text-slate-500">Select a step to see what happens</p>
      </div>

      {/* step picker */}
      <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
        <ol className="grid min-w-[600px] grid-cols-6 gap-2" role="tablist" aria-label="Trip steps">
          {STEPS.map((item, i) => {
            const Icon = STEP_ICON[item.key];
            const active = i === index;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setIndex(i)}
                  className={`flex w-full flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center transition ${
                    active
                      ? "border-teal-600 bg-teal-50 shadow-sm"
                      : "border-slate-200 hover:border-teal-600/50 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex size-9 items-center justify-center rounded-full ${
                      active ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Step {i + 1}</span>
                  <span className={`text-xs font-semibold leading-tight ${active ? "text-teal-800" : "text-slate-800"}`}>
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* what happens at the selected step */}
      <div key={step.key} role="tabpanel" className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 animate-fade sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Step {index + 1} of {STEPS.length}
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-teal-950">{step.label}</h3>
            <p className="text-sm text-slate-600">
              Who acts: <span className="font-medium text-slate-900">{detail.who}</span>
            </p>
          </div>
          {detail.policy ? <PolicyLink section={detail.policy} /> : null}
        </div>

        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-700">
          {detail.what.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-600" />
              {line}
            </li>
          ))}
        </ul>

        {detail.tip ? (
          <p className="mt-3 flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {detail.tip}
          </p>
        ) : null}

        {/* walk through the steps in order */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Previous
            </button>
            <button
              type="button"
              disabled={index === STEPS.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-white disabled:opacity-40"
            >
              Next
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {detail.action ? (
            <LinkButton to={detail.action.to} variant="primary" className="px-3 py-1.5 text-sm">
              {detail.action.label}
            </LinkButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Expandable how-to with numbered steps. */
function GuideCard({ guide, open }: { guide: Guide; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-slate-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold text-slate-900">{guide.title}</span>
          <span className="block text-xs text-slate-500">{guide.summary}</span>
        </span>
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <ol className="flex flex-col gap-2">
          {guide.steps.map((line, i) => (
            <li key={line} className="flex gap-3 text-sm text-slate-700">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[11px] font-semibold text-teal-800">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
        {guide.action ? (
          <LinkButton to={guide.action.to} className="mt-3 px-3 py-1.5 text-sm">
            {guide.action.label}
          </LinkButton>
        ) : null}
      </div>
    </details>
  );
}

function FaqItem({ faq, open }: { faq: Faq; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-slate-100 last:border-0 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
        {faq.q}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col items-start gap-2 px-4 pb-4 text-sm text-slate-600">
        <p>{faq.a}</p>
        {faq.policy ? <PolicyLink section={faq.policy} /> : null}
      </div>
    </details>
  );
}

/** Learning hub: trip walkthrough, guides for the signed-in role, and FAQs. */
export function HelpPage() {
  const { can } = useEmployee();
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();

  // guides for what this role can do
  const groups = GUIDE_GROUPS.filter((group) => group.visible(can));
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const activeGroup = groups.find((group) => group.id === groupId) ?? groups[0];

  // while searching: every matching guide and FAQ, expanded
  const foundGuides = search
    ? groups.flatMap((group) => group.guides).filter((g) => matches(search, g.title, g.summary, ...g.steps))
    : [];
  const faqs = search ? FAQS.filter((faq) => matches(search, faq.q, faq.a)) : FAQS;

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader eyebrow="Help" title="Learning hub">
        <p className="text-sm text-slate-500">How to raise a trip, claim your expenses and get paid — in a few minutes.</p>
      </PageHeader>

      {/* search guides and FAQs */}
      <label className="relative block max-w-xl">
        <span className="sr-only">Search help</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help, e.g. advance, receipt, payroll"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
      </label>

      {search ? (
        <section className="flex flex-col gap-3" aria-live="polite">
          <h2 className="text-sm font-semibold text-slate-800">
            {foundGuides.length + faqs.length} result{foundGuides.length + faqs.length === 1 ? "" : "s"} for “{query.trim()}”
          </h2>
          {foundGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} open />
          ))}
          {faqs.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              {faqs.map((faq) => (
                <FaqItem key={faq.q} faq={faq} open />
              ))}
            </div>
          ) : null}
          {foundGuides.length + faqs.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
              Nothing found. Try another word, or read the{" "}
              <Link to={POLICY.path} className="font-medium text-teal-700 underline underline-offset-2">
                {POLICY.title}
              </Link>
              .
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <JourneyExplorer />

          {/* how-to guides for this role */}
          {activeGroup ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Guides</h2>
                {groups.length > 1 ? (
                  <div role="tablist" aria-label="Guides for" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        role="tab"
                        aria-selected={group.id === activeGroup.id}
                        onClick={() => setGroupId(group.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          group.id === activeGroup.id ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {activeGroup.guides.map((guide, i) => (
                  <GuideCard key={`${activeGroup.id}-${guide.id}`} guide={guide} open={i === 0} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-slate-900">Frequently asked questions</h2>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              {faqs.map((faq) => (
                <FaqItem key={faq.q} faq={faq} />
              ))}
            </div>
          </section>

          <p className="text-sm text-slate-500">
            Still unsure? The full rules are in the{" "}
            <Link to={POLICY.path} className="font-medium text-teal-700 underline underline-offset-2">
              {POLICY.title} ({POLICY.docId})
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
