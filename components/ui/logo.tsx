"use client";

import { useBranding } from "@/components/branding/branding-provider";

// A bumper plate seen face-on: the gym's initials sit where the collar would.
// With a logo uploaded on the Branding page (D-124), the logo instead.
export function PlateMark({ size = 32 }: { size?: number }) {
  const { logoText } = useBranding();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="15" className="fill-plate" />
      <circle cx="16" cy="16" r="11" fill="none" strokeWidth="1" className="stroke-plate-ink/40" />
      <text x="16" y="20.5" textAnchor="middle" className="fill-plate-ink font-display" fontSize="12" fontWeight="700">
        {logoText}
      </text>
    </svg>
  );
}

export function Wordmark() {
  const { appName, logoUrl } = useBranding();
  return (
    <span className="flex items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-8 w-auto max-w-[8rem] shrink-0 object-contain" />
      ) : (
        <PlateMark />
      )}
      <span className="font-display text-lg font-semibold leading-none text-ink">{appName}</span>
    </span>
  );
}
