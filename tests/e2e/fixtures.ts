import { PrismaClient } from "@prisma/client";
import { gstFromInclusive } from "../../lib/money";
import { E2E_DATABASE_URL } from "../../playwright.config";

// Tests that change data create their own rows, so they don't depend on
// each other or on seed rows an earlier run (or a retry) already used (R-65).
// The default buyer isn't the member the member-app tests sign in as.
const prisma = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });

export async function createPaidOrder(email = "priya.sharma@example.com") {
  const member = await prisma.member.findUniqueOrThrow({ where: { email } });
  const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku: "CHALK-250" }, include: { product: true } });
  const now = new Date();
  return prisma.order.create({
    data: {
      memberId: member.id,
      email: member.email,
      customerName: member.name ?? member.email,
      status: "PAID",
      fulfilment: "PICKUP",
      subtotalCents: variant.priceCents,
      totalCents: variant.priceCents,
      gstCents: gstFromInclusive(variant.priceCents),
      stockCommitted: true,
      paidAt: now,
      items: {
        create: [{ variantId: variant.id, productName: variant.product.name, variantLabel: "Standard", category: variant.product.category, unitPriceCents: variant.priceCents, quantity: 1, lineTotalCents: variant.priceCents }],
      },
      events: { create: [{ status: "PAID", actorName: "Stripe" }] },
    },
  });
}
