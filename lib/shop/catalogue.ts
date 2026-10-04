import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { variantLabel } from "./labels";
import { memberShopDiscount } from "./checkout";

export interface CatalogueVariant {
  id: string;
  label: string;
  priceCents: number;
  available: boolean;
  lowStock: boolean;
  maxQuantity: number;
}

export interface CatalogueProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: "APPAREL" | "SUPPLEMENTS" | "ACCESSORIES" | "OTHER";
  imageUrl: string | null;
  variants: CatalogueVariant[];
}

export interface Catalogue {
  discountPercent: number;
  signedIn: boolean;
  shipping: { pickupOnly: boolean; flatCents: number; freeOverCents: number | null };
  changeOfMindReturnsDays: number;
  products: CatalogueProduct[];
}

// The public catalogue. Exact stock counts stay private; customers see
// whether something is available or nearly gone. A signed-in member's
// discount is included so pages can show the price they'll pay.
export async function getCatalogue(db: Db, memberId: string | null, where: { slug?: string } = {}): Promise<Catalogue> {
  const products = await db.product.findMany({
    where: { active: true, variants: { some: { active: true } }, ...where },
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
  return {
    discountPercent: memberId ? await memberShopDiscount(db, memberId) : 0,
    signedIn: Boolean(memberId),
    shipping: { pickupOnly: gym.policies.shop.pickupOnly, flatCents: gym.policies.shop.flatShippingCents, freeOverCents: gym.policies.shop.freeShippingOverCents },
    changeOfMindReturnsDays: gym.policies.shop.changeOfMindReturnsDays,
    products: products.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({
        id: v.id,
        label: variantLabel(v),
        priceCents: v.priceCents,
        available: v.stockQty > 0,
        lowStock: v.stockQty > 0 && v.stockQty <= 3,
        maxQuantity: Math.min(v.stockQty, 20),
      })),
    })),
  };
}
