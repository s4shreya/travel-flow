import { useState, type SubmitEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  History,
  type LucideIcon,
} from "lucide-react";

import { BrandMark } from "@/components/layout/BrandMark";
import { Alert } from "@/components/ui/Alert";
import { Loader } from "@/components/ui/Loader";
import { useEmployee } from "@/context/EmployeeContext";
import { errorMessage } from "@/lib/errors";
import { paths } from "@/lib/routes";
import { isValidEmail } from "@/lib/validation";

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: "Requests that shape themselves",
    text: "Pick what you are raising and the form, the policy rules and the approval chain come with it — checked live as you fill it in.",
  },
  {
    icon: Sparkles,
    title: "Assistance, not autopilot",
    text: "Receipts and documents are read for you and reconciled against what you claim — always as a suggestion you confirm.",
  },
  {
    icon: History,
    title: "Every step on the record",
    text: "Every approval, return and payment is recorded with who acted, when and why — and nobody can approve or pay out their own claim.",
  },
];

/** Seeded demo accounts (all share the demo password). */
const DEMO_ACCOUNTS = [
  { role: "Employee", email: "chaitanya@nortex.com" },
  { role: "Reporting Manager", email: "suresh@nortex.com" },
  { role: "Head of Department", email: "meera@nortex.com" },
  { role: "Finance", email: "ravi@nortex.com" },
  { role: "Administrator", email: "admin@nortex.com" },
];
const DEMO_PASSWORD = "Nortex@2026";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10";

export function LoginPage() {
  const { employee, login } = useEmployee();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signing in always lands on the dashboard
  if (employee) {
    return <Navigate to={paths.home} replace />;
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    // Catch obvious typos before hitting the server
    if (!isValidEmail(email)) {
      setError("Enter a valid work email, e.g. name@nortex.com");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(paths.home, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Sign in failed"));
    } finally {
      setSubmitting(false);
    }
  }

  // Prefill a demo account (assignment reviewers)
  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl"
        />

        <BrandMark inverted />

        <div className="relative my-auto max-w-md">
          <h1 className="font-display text-4xl leading-tight text-white">
            Reimbursements that explain themselves.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-teal-100/80">
            One place to raise a claim, see the policy that governs it, and
            follow it all the way through to payment.
          </p>
          <ul className="mt-10 flex flex-col gap-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300 ring-1 ring-white/15">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-teal-100/75">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-teal-100/60">
          © {new Date().getFullYear()} Nortex Industries Ltd · Internal use only
        </p>
      </section>

      {/* Sign-in form */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm animate-in">
          <div className="lg:hidden">
            <BrandMark />
          </div>

          <h2 className="mt-8 font-display text-2xl text-slate-900 lg:mt-0">
            Sign in
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">Use your work email.</p>

          <form
            onSubmit={(event) => void onSubmit(event)}
            className="mt-8 flex flex-col gap-5"
            noValidate
          >
            {error ? <Alert tone="error">{error}</Alert> : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Work email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@nortex.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/25 disabled:cursor-not-allowed disabled:bg-teal-700/50"
            >
              {submitting ? (
                <>
                  <Loader size="sm" className="text-white" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </form>

          {/* Demo access helper */}
          <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Demo access
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Password for all accounts:{" "}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
                {DEMO_PASSWORD}
              </code>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemoAccount(account.email)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition odd:last:col-span-2 odd:last:mx-auto odd:last:w-[calc(50%-0.25rem)] odd:last:text-center hover:border-teal-600/40 hover:bg-teal-50/40"
                >
                  <span className="block text-xs font-medium text-slate-800">
                    {account.role}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {account.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
