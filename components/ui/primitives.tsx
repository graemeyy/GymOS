import React from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors min-h-tap px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";

const buttonVariants = {
  primary: "bg-plate text-plate-ink hover:bg-plate-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  ghost: "text-ink-soft hover:text-ink hover:bg-sunken",
  danger: "bg-surface text-bad border border-bad hover:bg-bad-tint",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function Button({
  variant = "primary",
  className,
  busy = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return (
    <button
      type={props.type ?? "button"}
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={cn(buttonBase, buttonVariants[variant], className)}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={cn(buttonBase, buttonVariants[variant], className)} />;
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn("inline-flex h-tap w-tap items-center justify-center rounded text-ink-soft hover:bg-sunken hover:text-ink disabled:opacity-50", className)}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

export function Panel({
  as: Tag = "section",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "aside" }) {
  return (
    <Tag {...props} className={cn("rounded-lg border border-line bg-surface", className)}>
      {children}
    </Tag>
  );
}

export function PanelHeader({ title, action, id }: { title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex min-h-[3.5rem] items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

const toneClasses = {
  neutral: "bg-sunken text-ink",
  good: "bg-good-tint text-good",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  plate: "bg-plate-tint text-plate",
} as const;

export type Tone = keyof typeof toneClasses;

// Status markers are small squared tags with a leading bar, not pills, so they
// read as labels on equipment rather than marketing chips.
export function StatusTag({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium", toneClasses[tone])}>
      <span aria-hidden="true" className="h-2.5 w-0.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
