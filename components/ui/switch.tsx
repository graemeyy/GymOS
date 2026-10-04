"use client";

import { useId } from "react";
import { cn } from "@/lib/client/cn";

export function Switch({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p id={`${id}-label`} className="font-medium">
          {label}
        </p>
        {description ? (
          <p id={`${id}-desc`} className="text-sm text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
          checked ? "border-plate bg-plate" : "border-line-strong bg-sunken"
        )}
      >
        <span className={cn("inline-block h-5 w-5 rounded-full bg-surface transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </button>
    </div>
  );
}
