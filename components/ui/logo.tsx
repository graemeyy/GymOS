import { gym } from "@/lib/config";

// A bumper plate seen face-on: the gym's initials sit where the collar would.
export function PlateMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="15" className="fill-plate" />
      <circle cx="16" cy="16" r="11" fill="none" strokeWidth="1" className="stroke-plate-ink/40" />
      <text x="16" y="20.5" textAnchor="middle" className="fill-plate-ink font-display" fontSize="12" fontWeight="700">
        {gym.brand.logoText}
      </text>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <PlateMark />
      <span className="font-display text-lg font-semibold leading-none text-ink">{gym.brand.shortName}</span>
    </span>
  );
}
