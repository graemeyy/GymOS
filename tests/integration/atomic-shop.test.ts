// R-98 for the shop, orders, payments and membership checkout: a change and
// its audit entry are written together or not at all. The audit write is made
// to fail; the change must not be left behind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const failAudit = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    logAction: async (...args: Parameters<typeof actual.logAction>) => {
      if (failAudit.on) throw new Error("audit write failed");
      return actual.logAction(...args);
    },
  };
});

const products = await import("@/app/api/products/route");
const product = await import("@/app/api/products/[id]/route");
const variant = await import("@/app/api/product-variants/[id]/route");
const order = await import("@/app/api/orders/[id]/route");
const refund = await import("@/app/api/payments/[id]/refund/route");
const shopCheckout = await import("@/app/api/shop/checkout/route");
const membershipCheckout = await import("@/app/api/checkout/route");
const { call, createMember, createStaff, makeRequest, prisma, resetDb } = await import("../helpers");
const { installFakeStripe } = await import("../fake-stripe");

let stripe: ReturnType<typeof installFakeStripe>;

beforeEach(async () => {
  await resetDb();
  stripe = installFakeStripe();
});
afterEach(() => {
  failAudit.on = false;
  stripe.restore();
});

const productBody = { name: "Club tee", category: "APPAREL", variants: [{ sku: "T-M", size: "M", priceCents: 3500, stockQty: 4 }] };

async function seedProduct() {
  return prisma.product.create({
    data: { name: "Club tee", slug: "club-tee", category: "APPAREL", variants: { create: [{ sku: "T-M", size: "M", priceCents: 3500, stockQty: 4 }] } },
    include: { variants: true },
  });
}

describe("R-98 products", () => {
  it("creating a product rolls back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    failAudit.on = true;
    expect((await call(products.POST, await makeRequest("POST", "/x", { as: owner, body: productBody }))).status).toBe(500);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.productVariant.count()).toBe(0);
  });

  it("editing a product rolls back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const seeded = await seedProduct();
    const body = { ...productBody, name: "Renamed tee", variants: [{ id: seeded.variants[0].id, sku: "T-M", size: "M", priceCents: 4000 }, { sku: "T-L", size: "L", priceCents: 4000, stockQty: 2 }] };
    failAudit.on = true;
    expect((await call(product.PUT, await makeRequest("PUT", "/x", { as: owner, body }), { id: seeded.id })).status).toBe(500);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: seeded.id }, include: { variants: true } });
    expect(after.name).toBe("Club tee");
    expect(after.variants.map((v) => ({ sku: v.sku, priceCents: v.priceCents }))).toEqual([{ sku: "T-M", priceCents: 3500 }]);
  });

  it("archiving a product rolls back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const seeded = await seedProduct();
    failAudit.on = true;
    expect((await call(product.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id: seeded.id })).status).toBe(500);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: seeded.id } })).active).toBe(true);
  });

  it("adjusting a variant's stock rolls back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const seeded = await seedProduct();
    failAudit.on = true;
    const res = await call(variant.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { delta: -3, reason: "Damaged" } }), { id: seeded.variants[0].id });
    expect(res.status).toBe(500);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: seeded.variants[0].id } })).stockQty).toBe(4);
  });
});

describe("R-98 orders and payments", () => {
  async function paidOrder() {
    const m = await createMember();
    const seeded = await seedProduct();
    const v = seeded.variants[0];
    const created = await prisma.order.create({
      data: {
        memberId: m.id,
        email: m.email,
        customerName: m.name ?? "",
        status: "PAID",
        fulfilment: "PICKUP",
        subtotalCents: 3500,
        totalCents: 3500,
        gstCents: 318,
        paidAt: new Date(),
        stockCommitted: true,
        items: { create: [{ variantId: v.id, productName: "Club tee", variantLabel: "M", category: "APPAREL", unitPriceCents: 3500, quantity: 1, lineTotalCents: 3500 }] },
      },
    });
    const payment = await prisma.payment.create({ data: { memberId: m.id, amount: 3500, gstCents: 318, status: "succeeded", kind: "SHOP", orderId: created.id } });
    return { order: created, payment, variantId: v.id };
  }

  it("changing an order's status rolls back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const { order: o } = await paidOrder();
    failAudit.on = true;
    expect((await call(order.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { status: "PACKED" } }), { id: o.id })).status).toBe(500);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
    expect(await prisma.orderEvent.count({ where: { orderId: o.id } })).toBe(0);
  });

  it("refunding a payment rolls back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const { order: o, payment, variantId } = await paidOrder();
    failAudit.on = true;
    const res = await call(refund.POST, await makeRequest("POST", "/x", { as: owner, body: { amountCents: 3500, reason: "Wrong size", method: "MANUAL" } }), { id: payment.id });
    expect(res.status).toBe(500);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ refundedCents: 0, status: "succeeded" });
    expect(await prisma.refund.count()).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockQty).toBe(4);
  });
});

describe("R-98 checkouts", () => {
  it("starting a shop checkout leaves no order behind when the audit entry fails", async () => {
    const m = await createMember();
    const seeded = await seedProduct();
    failAudit.on = true;
    const res = await call(shopCheckout.POST, await makeRequest("POST", "/x", { as: { member: m }, body: { lines: [{ variantId: seeded.variants[0].id, quantity: 1 }], fulfilment: "PICKUP" } }));
    expect(res.status).toBe(500);
    expect(await prisma.order.count()).toBe(0);
  });

  it("starting a membership checkout records no terms acceptance when the audit entry fails", async () => {
    const m = await createMember({ status: "PENDING" });
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    failAudit.on = true;
    const res = await call(membershipCheckout.POST, await makeRequest("POST", "/x", { as: { member: m }, body: { planId: plan.id, acceptTerms: true } }));
    expect(res.status).toBe(500);
    expect(await prisma.legalAcceptance.count({ where: { memberId: m.id } })).toBe(0);
  });
});

afterEach(async () => {
  expect(await prisma.auditLog.count()).toBe(0);
});
