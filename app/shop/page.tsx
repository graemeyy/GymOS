import Link from "next/link";
import type { Metadata } from "next";
import { gym } from "@/lib/config";
import { formatAud } from "@/lib/money";
import { currentMemberId } from "@/lib/auth/server-session";
import { getCatalogue } from "@/lib/shop/queries";
import { listPlans } from "@/lib/plans";
import { CATEGORY_TEXT } from "@/lib/shop/labels";
import { PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/feedback";
import { Price } from "@/components/shop/price";

export const metadata: Metadata = { title: "Shop" };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [catalogue, plans] = await Promise.all([getCatalogue(await currentMemberId()), listPlans()]);
  const bestDiscount = Math.max(0, ...plans.map((p) => p.shopDiscountPercent));
  const groups = Object.entries(CATEGORY_TEXT)
    .map(([category, label]) => ({ category, label, products: catalogue.products.filter((p) => p.category === category) }))
    .filter((g) => g.products.length > 0);
  const { shipping } = catalogue;
  return (
    <div>
      <PageHeader
        title="Shop"
        description={[
          "Prices include GST.",
          catalogue.discountPercent > 0 ? `Your ${catalogue.discountPercent}% member discount is already taken off.` : catalogue.signedIn || bestDiscount === 0 ? null : `Members save up to ${bestDiscount}% when signed in.`,
          shipping.pickupOnly ? "Collect from the front desk." : `Collect from the front desk, or delivery for ${formatAud(shipping.flatCents)}${shipping.freeOverCents ? ` (free over ${formatAud(shipping.freeOverCents)})` : ""}.`,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {groups.length === 0 ? (
        <EmptyState title="Nothing in the shop yet">Check back soon, or ask at the front desk at {gym.business.address.suburb}.</EmptyState>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.category} aria-labelledby={`cat-${group.category}`}>
              <h2 id={`cat-${group.category}`} className="mb-3 text-2xl">
                {group.label}
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.products.map((p) => {
                  const available = p.variants.some((v) => v.available);
                  const from = Math.min(...p.variants.map((v) => v.priceCents));
                  const varies = new Set(p.variants.map((v) => v.priceCents)).size > 1;
                  return (
                    <li key={p.id}>
                      <Link href={`/shop/${p.slug}`} className="flex h-full flex-col justify-between gap-3 rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
                        <span>
                          <span className="block text-lg font-medium">{p.name}</span>
                          {p.description ? <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">{p.description}</span> : null}
                        </span>
                        <span className="flex items-end justify-between gap-3">
                          <Price cents={from} discountPercent={catalogue.discountPercent} prefix={varies ? "From" : undefined} />
                          <span className={available ? "text-sm text-ink-soft" : "text-sm font-medium text-bad"}>{available ? `${p.variants.length > 1 ? `${p.variants.length} options` : "In stock"}` : "Sold out"}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
