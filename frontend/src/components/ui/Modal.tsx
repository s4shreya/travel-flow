import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons, right-aligned at the bottom. */
  footer?: ReactNode;
  /** "alertdialog" for confirmations, "dialog" for forms. */
  role?: "dialog" | "alertdialog";
  /** "full" fills the viewport (e.g. a maximised document). */
  size?: "md" | "lg" | "xl" | "full";
  /** Extra header buttons, left of the close button. */
  actions?: ReactNode;
}

const WIDTH = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "h-full max-w-none",
} as const;

export function Modal({ title, onClose, children, footer, role = "dialog", size = "md", actions }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 animate-fade" aria-hidden onClick={onClose} />
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[calc(100vh-2rem)] w-full ${WIDTH[size]} flex-col overflow-hidden rounded-xl bg-white shadow-xl animate-in`}
      >
        {/* title + close */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-slate-900">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-600">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
