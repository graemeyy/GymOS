import { applyDiscount, formatAud } from "@/lib/money";

// Shows the member price, with the normal price beside it when a discount
// applies, so the saving is visible without any banner.
export function Price({ cents, discountPercent, prefix, className }: { cents: number; discountPercent: number; prefix?: string; className?: string }) {
  const price = applyDiscount(cents, discountPercent);
  return (
    <span className={className}>
      {prefix ? `${prefix} ` : null}
      <span className="tabular font-display text-2xl font-bold">{formatAud(price)}</span>
      {discountPercent > 0 ? (
        <span className="ml-2 text-sm text-ink-soft">
          <span className="sr-only">Normal price </span>
          <s>{formatAud(cents)}</s>
        </span>
      ) : null}
    </span>
  );
}
