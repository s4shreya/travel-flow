import { Info } from "lucide-react";

/** Small "i" icon that explains something on hover. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-flex">
      {/* Not focusable: it often sits inside a card link; screen readers read the tooltip text */}
      <Info
        aria-hidden
        className="size-3.5 cursor-help text-slate-400 transition group-hover/info:text-slate-700"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 translate-y-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition duration-150 group-hover/info:translate-y-0 group-hover/info:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
