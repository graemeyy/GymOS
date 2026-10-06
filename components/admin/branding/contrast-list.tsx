"use client";

import { Check, X } from "lucide-react";
import { contrastChecks } from "@/lib/branding/colour";

// Every place a brand colour carries text, with its contrast ratio against
// WCAG AA (4.5:1). Saving is refused while any fails (D-124).
export function ContrastList({ primaryColour, accentColour }: { primaryColour: string; accentColour: string }) {
  let checks: ReturnType<typeof contrastChecks> = [];
  try {
    checks = contrastChecks(primaryColour, accentColour);
  } catch {
    return null;
  }
  const failing = checks.filter((c) => !c.ok).length;
  return (
    <div>
      <p className="text-sm font-medium" role="status">
        {failing === 0 ? "All colour pairs are readable (WCAG AA, 4.5:1 or more)." : `${failing} colour pair${failing === 1 ? " isn't" : "s aren't"} readable enough. Change the colours before saving.`}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2">
            {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden="true" />}
            <span>
              <span className="sr-only">{c.ok ? "Passes: " : "Fails: "}</span>
              {c.label}: <span className="tabular font-medium">{c.ratio.toFixed(2)}:1</span>
              {c.ok ? null : <span className="text-bad"> {c.fix}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
