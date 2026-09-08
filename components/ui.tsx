import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface border border-line rounded-2xl p-6 ${className}`}>{children}</div>
  );
}

const buttonVariants = {
  primary: "bg-ember text-white hover:bg-ember-dark",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-muted",
  ghost: "text-ink-soft hover:text-ink hover:bg-surface-muted",
  danger: "bg-surface text-bad border border-bad/30 hover:bg-bad-soft",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: keyof typeof buttonVariants;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  variant?: keyof typeof buttonVariants;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

const badgeVariants = {
  neutral: "bg-surface-muted text-ink-soft",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: keyof typeof badgeVariants;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badgeVariants[variant]}`}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-soft max-w-lg">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneColor = {
    neutral: "text-ember",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];

  return (
    <Card className="flex items-start gap-4">
      <div className={`shrink-0 rounded-xl bg-surface-muted p-2.5 ${toneColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-ink-soft">{label}</p>
        <p className="font-display text-2xl font-medium text-ink mt-0.5">{value}</p>
      </div>
    </Card>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-ink-soft">
      {children}
    </div>
  );
}
