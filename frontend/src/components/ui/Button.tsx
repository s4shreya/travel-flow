import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-teal-800 text-white hover:bg-teal-900 disabled:bg-teal-800/50",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50",
  ghost: "text-teal-800 hover:bg-teal-50 disabled:opacity-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
