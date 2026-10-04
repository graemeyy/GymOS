import { publicRoute, json } from "@/lib/http/route";
import { resolveMember } from "@/lib/auth/session";
import { gym } from "@/lib/config";
import { variantLabel } from "@/lib/shop/labels";
import { memberShopDiscount } from "@/lib/shop/checkout";

// The public catalogue. Stock counts aren't shown, only whether something is
// available or nearly gone. A signed-in member also gets their discount, so
// the shop can show the price they'll actually pay.
export const GET = publicRoute({}, async ({ request, db }) => {
  const products = await db.product.findMany({
    where: { active: true, variants: { some: { active: true } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      imageUrl: true,
      variants: { where: { active: true }, orderBy: { priceCents: "asc" }, select: { id: true, size: true, colour: true, flavour: true, priceCents: true, stockQty: true } },
    },
  });
  const member = await resolveMember(request, db);
  const discountPercent = member ? await memberShopDiscount(db, member.id) : 0;
  return json({
    discountPercent,
    signedIn: Boolean(member),
    shipping: { pickupOnly: gym.policies.shop.pickupOnly, flatCents: gym.policies.shop.flatShippingCents, freeOverCents: gym.policies.shop.freeShippingOverCents },
    changeOfMindReturnsDays: gym.policies.shop.changeOfMindReturnsDays,
    products: products.map((p) => ({
      ...p,
      variants: p.variants.map(({ stockQty, ...v }) => ({ ...v, label: variantLabel(v), available: stockQty > 0, lowStock: stockQty > 0 && stockQty <= 3, maxQuantity: Math.min(stockQty, 20) })),
    })),
  });
});
