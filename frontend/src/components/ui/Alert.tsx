import type { ReactNode } from "react";

type Tone = "error" | "success" | "info";

const TONE_CLASS: Record<Tone, string> = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-teal-200 bg-teal-50 text-teal-950",
  info: "border-slate-200 bg-slate-50 text-slate-800",
};

interface AlertProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}

export function Alert({ tone = "info", title, children }: AlertProps) {
  return (
    <div
      role="status"
      className={`rounded-md border px-4 py-3 text-sm ${TONE_CLASS[tone]}`}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
