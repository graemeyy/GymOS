import { gym } from "@/lib/config";
import { applyDiscount, gstFromInclusive } from "@/lib/money";

// Pure pricing rules, shared by checkout on the server and the cart's
// estimate in the browser, so the two always agree.

export interface PricedLine {
  variantId: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

// Prices are GST-inclusive. The member discount applies per line, rounded to
// the cent, and shipping is added after discount. GST is 1/11 of the total.
export function priceOrder(lines: { variantId: string; quantity: number; unitPriceCents: number }[], discountPercent: number, fulfilment: "PICKUP" | "SHIPPING") {
  const priced: PricedLine[] = lines.map((l) => ({ ...l, lineTotalCents: applyDiscount(l.unitPriceCents * l.quantity, discountPercent) }));
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const afterDiscount = priced.reduce((s, l) => s + l.lineTotalCents, 0);
  const shop = gym.policies.shop;
  const freeShipping = shop.freeShippingOverCents !== null && afterDiscount >= shop.freeShippingOverCents;
  const shippingCents = fulfilment === "SHIPPING" && !freeShipping ? shop.flatShippingCents : 0;
  const totalCents = afterDiscount + shippingCents;
  return {
    lines: priced,
    subtotalCents,
    discountCents: subtotalCents - afterDiscount,
    shippingCents,
    totalCents,
    gstCents: gstFromInclusive(totalCents, gym.business.gstRegistered),
  };
}
