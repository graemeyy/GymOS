"use client";

import React, { useId } from "react";
import { cn } from "@/lib/client/cn";

const controlBase =
  "block w-full min-h-tap rounded border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-soft focus:border-plate focus:outline-none focus:ring-2 focus:ring-plate/30 disabled:bg-sunken disabled:text-ink-soft aria-[invalid=true]:border-bad";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
}

// Wires label, hint and error to the control with ids, so screen readers
// announce the field name and any problem with it.
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; wrapperClassName?: string };

export function TextField({ label, hint, error, wrapperClassName, className, ...props }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} {...props} className={cn(controlBase, className)} />
      )}
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string; wrapperClassName?: string };

export function SelectField({ label, hint, error, wrapperClassName, className, children, ...props }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} {...props} className={cn(controlBase, "pr-8", className)}>
          {children}
        </select>
      )}
    </Field>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string; wrapperClassName?: string };

export function TextareaField({ label, hint, error, wrapperClassName, className, ...props }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} {...props} className={cn(controlBase, "py-2", className)} />
      )}
    </Field>
  );
}

// A search box with a visible label for screen readers and a clear button.
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(controlBase, "pr-12")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-0 top-0 inline-flex h-tap w-tap items-center justify-center text-ink-soft hover:text-ink"
          aria-label="Clear search"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone = "bad", children }: { tone?: "bad" | "good"; children: React.ReactNode }) {
  return (
    <p role={tone === "bad" ? "alert" : "status"} className={cn("rounded px-3 py-2 text-sm font-medium", tone === "bad" ? "bg-bad-tint text-bad" : "bg-good-tint text-good")}>
      {children}
    </p>
  );
}
