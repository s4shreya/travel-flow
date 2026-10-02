import { Plane } from "lucide-react";

interface BrandMarkProps {
  /** Light text for dark backgrounds. */
  inverted?: boolean;
}

/** TravelFlow logo + company line. */
export function BrandMark({ inverted = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm",
          inverted ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-teal-700 text-white",
        ].join(" ")}
      >
        <Plane className="h-[18px] w-[18px] -rotate-45" strokeWidth={2.2} aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={`text-[15px] font-semibold tracking-tight ${inverted ? "text-white" : "text-slate-900"}`}
        >
          TravelFlow
        </span>
        <span
          className={`text-[11px] font-medium ${inverted ? "text-teal-100/80" : "text-slate-500"}`}
        >
          Nortex Industries
        </span>
      </span>
    </div>
  );
}
