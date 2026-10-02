import { Plane } from "lucide-react";

type LoaderSize = "sm" | "md" | "lg";

// Flight-path ring and plane size per loader size
const SIZE: Record<LoaderSize, { ring: string; plane: string; border: string }> = {
  sm: { ring: "size-4", plane: "size-2.5", border: "border" },
  md: { ring: "size-8", plane: "size-3.5", border: "border-2" },
  lg: { ring: "size-14", plane: "size-5", border: "border-2" },
};

interface LoaderProps {
  /** Visible text next to the animation; screen readers get "Loading" when omitted. */
  label?: string;
  size?: LoaderSize;
  /** Colour comes from the text colour, e.g. "text-teal-700" or "text-white". */
  className?: string;
}

/** The app's one loading animation: a plane circling a dashed flight path. */
export function Loader({ label, size = "md", className = "text-teal-700" }: LoaderProps) {
  const s = SIZE[size];
  return (
    <span role="status" className={`inline-flex items-center gap-3 ${className}`}>
      <span aria-hidden className={`relative inline-block shrink-0 ${s.ring}`}>
        {/* flight path */}
        <span className={`absolute inset-0 rounded-full border-dashed border-current opacity-30 ${s.border}`} />
        {/* plane flying clockwise around it */}
        <span className="absolute inset-0 animate-[spin_1.6s_linear_infinite]">
          <Plane
            className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-45 fill-current ${s.plane}`}
            strokeWidth={1.5}
          />
        </span>
      </span>
      {label ? <span className="text-sm font-medium text-slate-600">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Centred loader (animation only) for a page or section that is still fetching. */
export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center animate-fade">
      <Loader size="lg" />
    </div>
  );
}
