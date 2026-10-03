import React from "react";
import { cn } from "@/lib/client/cn";

export interface ScoreboardItem {
  label: string;
  value: string | null;
  note?: string;
  tone?: "neutral" | "alert";
  href?: string;
}

// The one loud element in the staff console: today's numbers set like a gym
// scoreboard, in condensed numerals on a single strip. Everything else on
// the page stays quiet so this reads first.
export function Scoreboard({ items, label }: { items: ScoreboardItem[]; label: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-lg border border-line bg-board text-board-ink">
      <dl className="grid grid-cols-2 divide-x divide-y divide-board-soft/30 sm:grid-cols-4 sm:divide-y-0">
        {items.map((item) => {
          const value = (
            <span
              className={cn(
                "tabular font-display text-4xl font-bold leading-none sm:text-5xl",
                item.tone === "alert" && item.value !== "0" ? "text-chalk" : "text-board-ink"
              )}
            >
              {item.value ?? "–"}
            </span>
          );
          return (
            <div key={item.label} className="px-4 py-4 sm:px-5 sm:py-5">
              <dt className="text-sm text-board-soft">{item.label}</dt>
              <dd className="mt-1">
                {item.href ? (
                  <a href={item.href} className="rounded-sm underline decoration-board-soft/50 decoration-2 underline-offset-4 hover:decoration-chalk focus-visible:outline-chalk">
                    {value}
                  </a>
                ) : (
                  value
                )}
                {item.note ? <span className="mt-1 block text-xs text-board-soft">{item.note}</span> : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
