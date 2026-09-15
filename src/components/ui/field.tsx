"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";

const control =
  "w-full rounded-control border border-line-strong bg-surface px-3.5 text-ink placeholder:text-ink-3 " +
  "transition-[border-color,box-shadow] duration-150 hover:border-ink-3 " +
  "focus-visible:outline-none focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus " +
  "aria-[invalid=true]:border-overdue disabled:opacity-60";

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optionalLabel?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
};

/** Visible label, hint and error, wired to the control with aria-describedby. */
export function Field({ label, hint, error, optionalLabel, children, className = "" }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optionalLabel ? <span className="text-xs font-normal text-ink-3">({optionalLabel})</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-overdue" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`${control} min-h-12 ${className}`} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = "", ...props },
  ref,
) {
  return <textarea ref={ref} className={`${control} min-h-24 py-3 leading-relaxed ${className}`} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = "", children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={`${control} min-h-12 appearance-none pe-10 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4.5 -translate-y-1/2 text-ink-2" aria-hidden />
    </div>
  );
});
