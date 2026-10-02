import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

const controlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-teal-700/50 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 disabled:bg-slate-50 group-data-[invalid=true]/field:border-red-400 group-data-[invalid=true]/field:focus:border-red-500 group-data-[invalid=true]/field:focus:ring-red-500/20";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  children,
}: FieldProps) {
  return (
    // data-invalid lets the control inside render a red border
    <div
      className="group/field flex flex-col gap-1.5"
      data-invalid={error ? "true" : undefined}
    >
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-700" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      className={`${controlClass} min-h-24 resize-y ${className}`}
      {...props}
    />
  );
}

