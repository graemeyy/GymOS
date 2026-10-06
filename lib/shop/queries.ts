import { prisma, type Db, type Tx } from "@/lib/db";
import { gym } from "@/lib/config";
import { variantLabel } from "./labels";
import type { Catalogue } from "./catalogue";
import type { Prisma } from "@prisma/client";
import type { OrderListFilter, ProductListFilter } from "./schema";
import { LOW_STOCK_AT, MAX_PER_ITEM } from "./limits";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";
import { listLocations } from "@/lib/locations/queries";

// The discount the member gets right now: their plan's shop discount while
// their membership is active. Signed-up members without a plan, and paused,
// overdue or cancelled memberships, pay the normal price.
export async function memberShopDiscount(db: Db | Tx, memberId: string): Promise<number> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { status: true, membershipPlan: { select: { shopDiscountPercent: true } } } });
  return member.status === "ACTIVE" ? member.membershipPlan?.shopDiscountPercent ?? 0 : 0;
}

// The public catalogue. Exact stock counts stay private; customers see
// whether something is available or nearly gone. A signed-in member's
// discount is included so pages can show the price they'll pay.
// Where a shopper's order comes from: the location asked for if it's open,
// else their home location, else the main location.
export async function shopLocation(db: Db | Tx, memberId: string | null, requested?: string | null): Promise<string> {
  if (requested && (await db.location.count({ where: { id: requested, archivedAt: null } }))) return requested;
  if (memberId) {
    const member = await db.member.findUnique({ where: { id: memberId }, select: { homeLocation: { select: { id: true, archivedAt: true } } } });
    if (member && !member.homeLocation.archivedAt) return member.homeLocation.id;
  }
  return MAIN_LOCATION_ID;
}

export async function getCatalogue(memberId: string | null, where: { slug?: string } = {}, db: Db = prisma, requestedLocation?: string | null): Promise<Catalogue> {
  const locationId = await shopLocation(db, memberId, requestedLocation);
  const locations = (await listLocations(db)).map((l) => ({ id: l.id, name: l.name, address: [l.addressLine1, l.suburb].filter(Boolean).join(", ") }));
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
      variants: { where: { active: true }, orderBy: { priceCents: "asc" }, select: { id: true, size: true, colour: true, flavour: true, priceCents: true, stock: { where: { locationId }, select: { quantity: true } } } },
    },
  });
  return {
    location: locations.find((l) => l.id === locationId) ?? { id: locationId, name: "", address: "" },
    locations,
    discountPercent: memberId ? await memberShopDiscount(db, memberId) : 0,
    signedIn: Boolean(memberId),
    shipping: { pickupOnly: gym.policies.shop.pickupOnly, flatCents: gym.policies.shop.flatShippingCents, freeOverCents: gym.policies.shop.freeShippingOverCents },
    changeOfMindReturnsDays: gym.policies.shop.changeOfMindReturnsDays,
    products: products.map((p) => ({
      ...p,
      variants: p.variants.map((v) => {
        const units = v.stock[0]?.quantity ?? 0;
        return { id: v.id, label: variantLabel(v), priceCents: v.priceCents, available: units > 0, lowStock: units > 0 && units <= LOW_STOCK_AT, maxQuantity: Math.min(units, MAX_PER_ITEM) };
      }),
    })),
  };
}

export async function getShopProductName(slug: string, db: Db = prisma): Promise<string | null> {
  const product = await db.product.findFirst({ where: { slug, active: true }, select: { name: true } });
  return product?.name ?? null;
}

export function listProducts(db: Db, filter: ProductListFilter) {
  return db.product.findMany({
    where: { ...(filter.category ? { category: filter.category } : {}), ...(filter.includeArchived === "1" ? {} : { active: true }) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { variants: { orderBy: [{ size: "asc" }, { colour: "asc" }, { flavour: "asc" }] } },
  });
}

export function getProduct(db: Db, id: string) {
  return db.product.findUnique({ where: { id }, include: { variants: { orderBy: [{ size: "asc" }, { colour: "asc" }] } } });
}

export function listOrders(db: Db, filter: OrderListFilter, where: Prisma.OrderWhereInput = {}) {
  return db.order.findMany({
    where: { ...(filter.status ? { status: filter.status } : filter.open === "1" ? { status: { in: ["PAID", "PACKED", "READY_FOR_PICKUP"] } } : {}), ...where },
    orderBy: { createdAt: "desc" },
    take: filter.take,
    select: {
      id: true,
      number: true,
      status: true,
      fulfilment: true,
      customerName: true,
      email: true,
      totalCents: true,
      createdAt: true,
      paidAt: true,
      location: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });
}

export function getOrder(db: Db, id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true } },
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      payment: { select: { id: true, amount: true, refundedCents: true, invoiceNumber: true } },
      member: { select: { id: true, name: true } },
    },
  });
}

// Abandoned checkouts are left out.
export function listOrdersForMember(db: Db, memberId: string) {
  return db.order.findMany({
    where: { memberId, NOT: { status: "CANCELLED", paidAt: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, number: true, status: true, fulfilment: true, totalCents: true, createdAt: true, _count: { select: { items: true } } },
  });
}

// Another member's order reads as missing. Staff notes on status changes are
// internal, so only statuses and times are included, plus the tracking number.
export function getOrderForMember(db: Db, memberId: string, id: string) {
  return db.order.findFirst({
    where: { id, memberId },
    select: {
      id: true,
      number: true,
      status: true,
      fulfilment: true,
      subtotalCents: true,
      discountCents: true,
      discountPercent: true,
      shippingCents: true,
      totalCents: true,
      gstCents: true,
      shippingAddress: true,
      trackingNumber: true,
      locationId: true,
      createdAt: true,
      paidAt: true,
      items: { select: { id: true, productName: true, variantLabel: true, quantity: true, unitPriceCents: true, lineTotalCents: true } },
      events: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
      payment: { select: { id: true, invoiceNumber: true, refundedCents: true } },
    },
  });
}
