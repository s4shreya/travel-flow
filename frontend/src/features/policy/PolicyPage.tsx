import { Children, isValidElement, useEffect, useMemo, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { useLocation } from "react-router-dom";
import remarkGfm from "remark-gfm";

import policyMarkdown from "@docs/expense_policy.md?raw";
import { PageHeader } from "@/components/layout/PageHeader";
import { POLICY } from "@/config/policy";

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? textOf(child.props.children)
          : "",
    )
    .join("");
}

function sectionId(node: ReactNode): string | undefined {
  const match = textOf(node).match(/^(\d+(?:\.\d+)?)/);
  return match ? `section-${match[1].replace(".", "-")}` : undefined;
}

const anchored = "scroll-mt-24 rounded-md transition-colors duration-700";
const highlighted = "bg-amber-50 ring-4 ring-amber-50";

function buildComponents(target: string): Components {
  const headingClass = (id?: string) =>
    `${anchored} ${id && id === target ? highlighted : ""}`;
  return {
    h1: () => null, // page header shows the title
    h2: ({ children }) => {
      const id = sectionId(children);
      return (
        <h2 id={id} className={`mt-8 border-b border-slate-200 pb-2 text-lg font-semibold text-teal-950 ${headingClass(id)}`}>
          {children}
        </h2>
      );
    },
    h3: ({ children }) => {
      const id = sectionId(children);
      return (
        <h3 id={id} className={`mt-5 text-base font-semibold text-slate-900 ${headingClass(id)}`}>
          {children}
        </h3>
      );
    },
    ...baseComponents,
  };
}

const baseComponents: Components = {
  p: ({ children }) => <p className="mt-3 text-sm leading-relaxed text-slate-700">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{children}</ul>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  hr: () => null,
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-slate-100 px-3 py-2 text-slate-700">{children}</td>,
};

const body = policyMarkdown.replace(/^#\s.*\n+Document.*\n/, "");

export function PolicyPage() {
  const { hash } = useLocation();
  const target = hash.replace(/^#/, "");
  const components = useMemo(() => buildComponents(target), [target]);

  // Content renders after load, so scroll to the linked section ourselves
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [target]);

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader eyebrow="Company policy" title={POLICY.title}>
        <p className="text-sm text-slate-500">
          {POLICY.docId} · {POLICY.revision} · Effective {POLICY.effective} · Applies to all India-based employees
        </p>
      </PageHeader>

      <article className="rounded-xl border border-slate-200 bg-white px-5 pb-8 pt-2 shadow-sm sm:px-8">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {body}
        </Markdown>
      </article>
    </div>
  );
}
