/* eslint-disable react-refresh/only-export-components -- provider + its hook live together */
import { CheckCircle2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface Toast {
  id: number;
  title: string;
  message?: string;
}

type ShowToast = (title: string, message?: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

// How long a toast stays on screen
const TOAST_MS = 8000;
// Matches the animate-toast-out duration
const EXIT_MS = 220;

let nextToastId = 0;

/** App-wide success toasts, shown top-right; survives page navigation. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ShowToast>((title, message) => {
    setToasts((prev) => [...prev, { id: ++nextToastId, title, message }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        // below the top bar so the bell and user menu stay clickable
        className="fixed top-20 right-4 z-[300] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [leaving, setLeaving] = useState(false);

  // auto-dismiss after a few seconds
  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // slide out, then remove
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, toast.id, onDismiss]);

  return (
    <div
      className={`relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 border-l-4 border-l-teal-600 bg-white p-4 shadow-xl ${
        leaving ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 animate-pop" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
        {toast.message ? (
          <p className="mt-0.5 text-sm text-slate-600">{toast.message}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setLeaving(true)}
        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      {/* time left before it closes */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-teal-500/60 animate-countdown"
        style={{ animationDuration: `${TOAST_MS}ms` }}
      />
    </div>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
