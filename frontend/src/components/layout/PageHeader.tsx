import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Small label above the title, e.g. "Finance". */
  eyebrow?: string;
  title: ReactNode;
  /** Shown under the title (policy reference, meta text). */
  children?: ReactNode;
  /** Shown on the right (status badge). */
  aside?: ReactNode;
}

export function PageHeader({ eyebrow, title, children, aside }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display mt-2 text-3xl text-teal-950">{title}</h1>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
      {aside}
    </div>
  );
}
