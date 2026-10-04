import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as products from "@/app/api/products/route";
import * as productById from "@/app/api/products/[id]/route";
import * as variant from "@/app/api/product-variants/[id]/route";
import * as orderById from "@/app/api/orders/[id]/route";
import * as refund from "@/app/api/payments/[id]/refund/route";
import * as announcements from "@/app/api/announcements/route";
import * as publish from "@/app/api/announcements/[id]/publish/route";
import * as myAnnouncements from "@/app/api/me/announcements/route";
import * as checkIn from "@/app/api/check-in/route";
import * as pass from "@/app/api/members/[id]/pass/route";
import * as password from "@/app/api/staff/me/password/route";
import * as audit from "@/app/api/audit-log/route";
import * as adminPlans from "@/app/api/admin/plans/route";
import { createPassToken } from "@/lib/checkin/qr";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";

let owner: As;
let desk: As;

beforeEach(async () => {
  await resetDb();
  owner = { staff: await createStaff("OWNER") };
  desk = { staff: await createStaff("FRONT_DESK") };
  captureEmailsForTests(true);
});
afterEach(() => captureEmailsForTests(false));

const tee = {
  name: "Club tee",
  category: "APPAREL",
  description: "Cotton tee.",
  variants: [
    { sku: "TEE-M", size: "M", colour: "Black", priceCents: 3500, stockQty: 5 },
    { sku: "TEE-L", size: "L", colour: "Black", priceCents: 3500, stockQty: 2 },
  ],
};

async function paidOrder(fulfilment: "PICKUP" | "SHIPPING" = "PICKUP") {
  const created = await call(products.POST, await makeRequest("POST", "/api/products", { as: owner, body: tee }));
  const v = (created.body.variants as { id: string; sku: string }[]).find((x) => x.sku === "TEE-M")!;
  const m = await createMember();
  const order = await prisma.order.create({
    data: {
      memberId: m.id,
      email: m.email,
      customerName: m.name ?? "",
      status: "PAID",
      fulfilment,
      subtotalCents: 3500,
      totalCents: 3500,
      gstCents: 318,
      stockCommitted: true,
      paidAt: new Date(),
      items: { create: [{ variantId: v.id, productName: "Club tee", variantLabel: "M, Black", category: "APPAREL", unitPriceCents: 3500, quantity: 1, lineTotalCents: 3500 }] },
    },
  });
  const payment = await prisma.payment.create({ data: { memberId: m.id, amount: 3500, gstCents: 318, status: "succeeded", kind: "SHOP", orderId: order.id } });
  return { order, payment, variantId: v.id };
}
const move = async (id: string, body: object, as: As = desk) => call(orderById.PATCH, await makeRequest("PATCH", "/x", { as, body }), { id });

describe("shop admin", () => {
  it("creates products with variants and refuses duplicate SKUs", async () => {
    const res = await call(products.POST, await makeRequest("POST", "/api/products", { as: owner, body: tee }));
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("club-tee");
    const dup = await call(products.POST, await makeRequest("POST", "/api/products", { as: owner, body: { ...tee, name: "Other tee" } }));
    expect(dup.status).toBe(409);
    expect((await call(products.POST, await makeRequest("POST", "/api/products", { as: desk, body: tee }))).status).toBe(403);
  });

  it("flags claim words on supplements but doesn't block them", async () => {
    const res = await call(products.POST, await makeRequest("POST", "/api/products", { as: owner, body: { name: "Pre-workout", category: "SUPPLEMENTS", description: "Clinically proven fat burner", variants: [{ sku: "PRE-1", priceCents: 5000 }] } }));
    expect(res.status).toBe(201);
    expect(res.body.claimWarnings).toEqual(expect.arrayContaining(["clinically proven", "fat burner"]));
  });

  it("editing keeps past variants (deactivated) so old orders still make sense", async () => {
    const { order, variantId } = await paidOrder();
    const product = await prisma.product.findFirstOrThrow();
    const res = await call(productById.PUT, await makeRequest("PUT", "/x", { as: owner, body: { ...tee, variants: [{ sku: "TEE-XL", size: "XL", priceCents: 3500, stockQty: 1 }] } }), { id: product.id });
    expect(res.status).toBe(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).active).toBe(false);
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("stock can't go below zero", async () => {
    const { variantId } = await paidOrder();
    expect((await call(variant.PATCH, await makeRequest("PATCH", "/x", { as: desk, body: { delta: -100 } }), { id: variantId })).status).toBe(409);
    expect((await call(variant.PATCH, await makeRequest("PATCH", "/x", { as: desk, body: { delta: 3 } }), { id: variantId })).body.stockQty).toBe(8);
  });
});

describe("orders", () => {
  it("moves through packing to pickup and collection, recording each step", async () => {
    const { order } = await paidOrder("PICKUP");
    expect((await move(order.id, { status: "PACKED" })).status).toBe(200);
    expect((await move(order.id, { status: "SHIPPED", trackingNumber: "X" })).status).toBe(409);
    expect((await move(order.id, { status: "READY_FOR_PICKUP" })).status).toBe(200);
    expect((await move(order.id, { status: "COMPLETED" })).status).toBe(200);
    expect(await prisma.orderEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" }, select: { status: true } })).toEqual([{ status: "PACKED" }, { status: "READY_FOR_PICKUP" }, { status: "COMPLETED" }]);
  });

  it("needs a tracking number to ship", async () => {
    const { order } = await paidOrder("SHIPPING");
    await move(order.id, { status: "PACKED" });
    expect((await move(order.id, { status: "SHIPPED" })).status).toBe(422);
    expect((await move(order.id, { status: "SHIPPED", trackingNumber: "AP123456" })).status).toBe(200);
  });

  it("a paid order must be refunded, not cancelled, and a full refund marks it refunded", async () => {
    const { order, payment } = await paidOrder();
    expect((await move(order.id, { status: "CANCELLED" })).status).toBe(409);
    const manager = { staff: await createStaff("MANAGER") };
    await call(refund.POST, await makeRequest("POST", "/x", { as: manager, body: { amountCents: 3500, reason: "Wrong size", method: "MANUAL" } }), { id: payment.id });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
  });
});

describe("announcements", () => {
  it("publishes, emails only opted-in members in the audience, once", async () => {
    const plan = await prisma.membershipPlan.findFirstOrThrow({ where: { slug: "unlimited" } });
    const onPlan = await createMember();
    await prisma.member.update({ where: { id: onPlan.id }, data: { planId: plan.id } });
    const optedOut = await createMember();
    await prisma.member.update({ where: { id: optedOut.id }, data: { planId: plan.id, notifyAnnouncements: false } });
    const otherPlan = await createMember({ planSlug: "standard" });
    const manager = { staff: await createStaff("MANAGER") };

    const created = await call(announcements.POST, await makeRequest("POST", "/api/announcements", { as: manager, body: { title: "Unlimited members: new open gym hours", body: "Open gym on Sunday afternoons from next week.", audience: "PLAN", planId: plan.id } }));
    expect(created.status).toBe(201);
    const id = String(created.body.id);
    const res = await call(publish.POST, await makeRequest("POST", "/x", { as: manager, body: { email: true } }), { id });
    expect(res.body.emailed).toBe(1);
    expect(capturedEmails().map((e) => e.to)).toEqual([onPlan.email]);
    expect((await call(publish.POST, await makeRequest("POST", "/x", { as: manager, body: { email: true } }), { id })).body.emailed).toBe(0);

    const seen = await call(myAnnouncements.GET, await makeRequest("GET", "/x", { as: { member: onPlan } }));
    expect((seen.body as unknown as { title: string }[]).map((a) => a.title)).toEqual(["Unlimited members: new open gym hours"]);
    const notSeen = await call(myAnnouncements.GET, await makeRequest("GET", "/x", { as: { member: otherPlan } }));
    expect(notSeen.body).toEqual([]);
  });

  it("front desk can't post announcements", async () => {
    expect((await call(announcements.POST, await makeRequest("POST", "/api/announcements", { as: desk, body: { title: "Hello", body: "World!" } }))).status).toBe(403);
  });
});

describe("QR check-in and grace period", () => {
  it("accepts a current pass and refuses a reissued one", async () => {
    const m = await createMember();
    const token = await createPassToken(m.id, 0);
    const scan = async () => call(checkIn.POST, await makeRequest("POST", "/api/check-in", { as: desk, body: { query: token } }));
    const ok = await scan();
    expect(ok.body).toMatchObject({ granted: true, method: "QR" });
    await call(pass.POST, await makeRequest("POST", "/x", { as: desk }), { id: m.id });
    expect((await scan()).status).toBe(409);
  });

  it("lets a past-due member in during the grace period with a warning, then refuses", async () => {
    const m = await createMember({ status: "PAST_DUE" });
    await prisma.member.update({ where: { id: m.id }, data: { pastDueSince: new Date(Date.now() - 2 * 86_400_000) } });
    const first = await call(checkIn.POST, await makeRequest("POST", "/api/check-in", { as: desk, body: { query: m.id } }));
    expect(first.body).toMatchObject({ granted: true, warning: expect.stringContaining("Payment overdue") });
    await prisma.member.update({ where: { id: m.id }, data: { pastDueSince: new Date(Date.now() - 10 * 86_400_000) } });
    const later = await call(checkIn.POST, await makeRequest("POST", "/api/check-in", { as: desk, body: { query: m.id } }));
    expect(later.body).toMatchObject({ granted: false, reason: "Payment overdue" });
  });
});

describe("staff self-service, plans and audit", () => {
  it("changing your password needs the current one and signs out other sessions", async () => {
    const person = await createStaff("FRONT_DESK", { password: "correct-horse-battery" });
    const as = { staff: person };
    expect((await call(password.POST, await makeRequest("POST", "/x", { as, body: { currentPassword: "wrong", newPassword: "a-new-long-password" } }))).status).toBe(422);
    const ok = await call(password.POST, await makeRequest("POST", "/x", { as, body: { currentPassword: "correct-horse-battery", newPassword: "a-new-long-password" } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/gymos_session=/);
    expect((await prisma.staff.findUniqueOrThrow({ where: { id: person.id } })).sessionVersion).toBe(person.sessionVersion + 1);
  });

  it("owners create plans with benefits; managers can't", async () => {
    const body = { name: "Student", priceCents: 2495, interval: "WEEK", classCreditsPerCycle: 1, guestPassesPerCycle: 0, shopDiscountPercent: 5, guestRateCents: 2000, description: null };
    expect((await call(adminPlans.POST, await makeRequest("POST", "/x", { as: { staff: await createStaff("MANAGER") }, body }))).status).toBe(403);
    const res = await call(adminPlans.POST, await makeRequest("POST", "/x", { as: owner, body }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slug: "student", classCreditsPerCycle: 1, shopDiscountPercent: 5 });
  });

  it("the audit log filters by area", async () => {
    await prisma.auditLog.createMany({ data: [{ staffName: "A", action: "billing.refunded", targetType: "Payment" }, { staffName: "B", action: "class.booked", targetType: "Class" }] });
    const res = await call(audit.GET, await makeRequest("GET", "/api/audit-log?action=billing.", { as: owner }));
    expect((res.body.items as { action: string }[]).map((i) => i.action)).toEqual(["billing.refunded"]);
  });
});
