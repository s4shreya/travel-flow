export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-teal-800 text-white hover:bg-teal-900 disabled:bg-teal-800/50",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50",
  ghost: "text-teal-800 hover:bg-teal-50 disabled:opacity-50",
  // Destructive actions (reject)
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50",
};

/** Shared look for <Button> and <LinkButton>. */
export function buttonClass(variant: ButtonVariant = "primary", className = ""): string {
  return `inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${className}`;
}
