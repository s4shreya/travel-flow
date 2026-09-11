import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  /** Where to go when there is no useful history entry. */
  fallbackTo?: string;
  label?: string;
}

/** Shared page back control */
export function BackButton({
  fallbackTo = "/",
  label = "Back",
}: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx;
        if (typeof idx === "number" && idx > 0) {
          navigate(-1);
          return;
        }
        navigate(fallbackTo);
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-teal-800 transition hover:text-teal-950"
    >
      <span aria-hidden className="text-base leading-none">
        ←
      </span>
      {label}
    </button>
  );
}
