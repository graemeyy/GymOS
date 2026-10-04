import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { gstFromInclusive } from "../lib/money";
import { syncPlansFromConfig } from "../lib/plans/service";
import { gym } from "../lib/config";
import { DAY_MS } from "../lib/time";
import { PRESET_ROLES, PRESETS } from "../lib/auth/permissions";
import { CLASSES, daysAgo, DEMO_MEMBERS, DEMO_STAFF, EQUIPMENT, inDays, INVENTORY, PRODUCTS, TEMPLATES } from "./seed-fixtures";

export { DEMO_MEMBERS, DEMO_STAFF };

export async function isDatabaseEmpty(prisma: PrismaClient) {
  const [members, staff] = await Promise.all([prisma.member.count(), prisma.staff.count()]);
  return members === 0 && staff === 0;
}

// Deletes every row in the tables the seed fills, seeded or not, children
// before parents. Only `npm run db:seed -- --reset` against a local database
// and the end-to-end test setup call it.
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.announcement.deleteMany(),
    prisma.orderEvent.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.memberNote.deleteMany(),
    prisma.legalAcceptance.deleteMany(),
    prisma.benefitLedger.deleteMany(),
    prisma.membershipEvent.deleteMany(),
    prisma.paymentReminder.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.classWaitlist.deleteMany(),
    prisma.classBooking.deleteMany(),
    prisma.class.deleteMany(),
    prisma.classTemplate.deleteMany(),
    prisma.checkIn.deleteMany(),
    prisma.member.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.staff.deleteMany(),
    prisma.equipment.deleteMany(),
    prisma.agentAction.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.stripeEvent.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.gymSettings.deleteMany(),
  ]);
  await restorePresetRoles(prisma);
}

export const presetRoleId = (preset: (typeof PRESETS)[number]) => `role_${preset.toLowerCase()}`;

// Custom roles go and the presets go back to what the migration created, so
// one test's role changes can't leak into the next. Run after staff are gone.
export async function restorePresetRoles(prisma: PrismaClient) {
  await prisma.role.deleteMany({ where: { preset: null } });
  for (const preset of PRESETS) {
    const { name, description, isOwner, permissions } = PRESET_ROLES[preset];
    const data = { name, description, isOwner, permissions: [...permissions] };
    await prisma.role.upsert({ where: { preset }, update: data, create: { id: presetRoleId(preset), preset, ...data } });
  }
}

// `password` is for every demo account that can sign in. Nothing in the
// repository says what it is (D-110): prisma/seed.ts takes it from
// SEED_DEMO_PASSWORD or makes a random one. Every seeded account has to
// change it at first sign-in (D-111).
export async function seedDatabase(prisma: PrismaClient, opts: { password: string }) {
  if (opts.password.length < 10) throw new Error("The demo password must be at least 10 characters.");
  await syncPlansFromConfig(prisma);
  const plans = new Map((await prisma.membershipPlan.findMany()).map((p) => [p.slug, p]));
  const passwordHash = await hashPassword(opts.password);

  for (const s of DEMO_STAFF) {
    await prisma.staff.create({ data: { name: s.name, email: s.email, role: s.role, roleId: presetRoleId(s.preset), passwordHash, mustChangePassword: true } });
  }

  const memberIds: string[] = [];
  for (const [i, m] of DEMO_MEMBERS.entries()) {
    const plan = plans.get(m.plan);
    const joined = m.status === "PENDING" ? daysAgo(1) : daysAgo(400 - i * 25);
    const member = await prisma.member.create({
      data: {
        name: m.name,
        email: m.email,
        status: m.status,
        planId: plan?.id ?? null,
        retentionScore: m.retentionScore,
        lastCheckIn: m.lastSeenDays === null ? null : daysAgo(m.lastSeenDays, 2),
        keycardIssued: m.status !== "CANCELED" && m.status !== "PENDING",
        onboardedAt: m.status === "PENDING" ? null : joined,
        passwordHash: m.login ? passwordHash : null,
        mustChangePassword: Boolean(m.login),
        // The member who "signed up online yesterday" hasn't confirmed their
        // email yet, so the banner can be seen (D-113).
        emailVerifiedAt: m.status === "PENDING" ? null : joined,
        createdAt: joined,
        pastDueSince: m.status === "PAST_DUE" ? daysAgo(m.retentionScore > 50 ? 2 : 9) : null,
        amountOwingCents: m.status === "PAST_DUE" && plan ? plan.priceCents : 0,
        cancelledAt: m.status === "CANCELED" ? daysAgo(12) : null,
        pausedFrom: m.status === "PAUSED" ? daysAgo(10) : null,
        pausedUntil: m.status === "PAUSED" ? new Date(Date.now() + 20 * DAY_MS) : null,
      },
    });
    memberIds.push(member.id);
    if (m.notes) {
      await prisma.memberNote.create({ data: { memberId: member.id, staffName: "Aisha Rahman", body: m.notes, createdAt: daysAgo(3) } });
    }
    if (m.status !== "PENDING") {
      await prisma.membershipEvent.create({ data: { memberId: member.id, type: "JOINED", effectiveAt: joined, actorName: "Aisha Rahman", createdAt: joined } });
    }
    // Members who use the app have accepted the current documents.
    if (m.login || m.status === "PENDING") {
      await prisma.legalAcceptance.createMany({
        data: (["TERMS", "PRIVACY"] as const).map((document) => ({ memberId: member.id, document, version: document === "TERMS" ? gym.legal.termsVersion : gym.legal.privacyVersion, context: m.status === "PENDING" ? "signup" : "reaccept", acceptedAt: joined })),
      });
    }
    if (m.status === "CANCELED") {
      await prisma.membershipEvent.create({ data: { memberId: member.id, type: "CANCELLED", effectiveAt: daysAgo(12), details: { reason: "Moving interstate" }, actorName: "Tom Nguyen" } });
    }

    // About three weeks of visits at their usual rate.
    const visits = Math.round(m.visitsPerWeek * 3);
    for (let v = 0; v < visits; v++) {
      await prisma.checkIn.create({
        data: { memberId: member.id, location: "Front desk", timestamp: daysAgo((m.lastSeenDays ?? 30) + Math.floor((v * 21) / Math.max(visits, 1)), v % 12) },
      });
    }

    // Weekly payments for the last eight weeks for members who've paid.
    if (plan && m.status !== "CANCELED") {
      const paidWeeks = m.status === "PAST_DUE" ? 6 : 8;
      for (let w = 0; w < paidWeeks; w++) {
        await prisma.payment.create({
          data: {
            memberId: member.id,
            amount: plan.priceCents,
            gstCents: gstFromInclusive(plan.priceCents),
            currency: "aud",
            status: "succeeded",
            description: `${plan.name} membership`,
            planName: plan.name,
            kind: "MEMBERSHIP",
            createdAt: daysAgo(w * 7 + (m.status === "PAST_DUE" ? 14 : 0) + 1),
            paidAt: daysAgo(w * 7 + (m.status === "PAST_DUE" ? 14 : 0) + 1),
          },
        });
      }
    }
  }

  // Referrals: a couple of members brought friends in.
  await prisma.member.update({ where: { id: memberIds[2] }, data: { referredById: memberIds[0] } });
  await prisma.member.update({ where: { id: memberIds[6] }, data: { referredById: memberIds[0] } });

  const trainers = new Map((await prisma.staff.findMany()).map((s) => [s.name, s.id]));
  for (const [i, c] of CLASSES.entries()) {
    const cls = await prisma.class.create({
      data: { name: c.name, instructor: c.instructor, trainerId: trainers.get(c.instructor) ?? null, startTime: inDays(c.day, c.hourUtc), durationMinutes: c.durationMinutes, capacity: c.capacity },
    });
    // Only Unlimited members are pre-booked, so nobody's class credits are off.
    const active = memberIds.filter((_, idx) => DEMO_MEMBERS[idx].status === "ACTIVE" && DEMO_MEMBERS[idx].plan === "unlimited");
    const take = i === 3 ? c.capacity : Math.min(active.length, 3 + i);
    for (const memberId of active.slice(0, take)) {
      await prisma.classBooking.create({ data: { classId: cls.id, memberId } });
    }
  }

  // Weekly timetable slots (not generated into dated classes here, so the
  // demo classes above stay as they are; "Generate" in the app adds more).
  for (const { trainer, ...slot } of TEMPLATES) {
    await prisma.classTemplate.create({ data: { ...slot, trainerId: trainers.get(trainer) ?? null } });
  }

  await seedShop(prisma);

  // Goodwill adjustment and an announcement.
  await prisma.benefitLedger.create({ data: { memberId: memberIds[1], kind: "CLASS_CREDIT", delta: 2, reason: "Class cancelled by the gym last week", refType: "adjustment" } });
  await prisma.announcement.create({
    data: {
      title: "Long weekend hours",
      body: "We're open 8am to 12pm on the public holiday Monday. Classes are back to normal on Tuesday.",
      publishedAt: daysAgo(1),
      expiresAt: new Date(Date.now() + 7 * DAY_MS),
    },
  });

  for (const e of EQUIPMENT) await prisma.equipment.create({ data: { ...e } });
  for (const item of INVENTORY) await prisma.inventoryItem.create({ data: item });
  await prisma.gymSettings.create({ data: { id: "singleton" } });

  const owner = await prisma.staff.findUniqueOrThrow({ where: { email: "owner@example.com" } });
  const frontDesk = await prisma.staff.findUniqueOrThrow({ where: { email: "frontdesk@example.com" } });
  for (let d = 0; d < 5; d++) {
    await prisma.shift.create({ data: { staffId: frontDesk.id, startTime: inDays(d, 19), endTime: inDays(d + 1, 3), notes: d === 0 ? "Opening shift" : null } });
  }
  await prisma.shift.create({ data: { staffId: owner.id, startTime: inDays(1, 22), endTime: inDays(2, 6) } });

  return { staff: DEMO_STAFF.length, members: DEMO_MEMBERS.length, classes: CLASSES.length };
}

// Products with variants, and a handful of orders across the fulfilment states.
async function seedShop(prisma: PrismaClient) {
  // Shop: fictional products. Descriptions make no health or performance claims.
  const variantIds: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        variants: { create: p.variants.map((v) => ({ ...v, size: v.size ?? null, colour: v.colour ?? null, flavour: v.flavour ?? null })) },
      },
      include: { variants: true },
    });
    for (const v of product.variants) variantIds[v.sku] = v.id;
  }

  // A handful of orders across the fulfilment states.
  // Looked up by email so each order goes to the intended buyer; findMany
  // doesn't return rows in the order of the list.
  const buyerEmails = ["charlotte.pham@example.com", "jack.osullivan@example.com", "priya.sharma@example.com"];
  const buyers = await Promise.all(buyerEmails.map((email) => prisma.member.findUniqueOrThrow({ where: { email } })));
  const orderSpecs = [
    { buyer: 0, status: "PAID", fulfilment: "PICKUP", items: [["TEE-IB-M-BLK", 1], ["CHALK-250", 2]], daysAgo: 1 },
    { buyer: 1, status: "PACKED", fulfilment: "SHIPPING", items: [["WPI-1KG-CHOC", 1]], daysAgo: 2 },
    { buyer: 2, status: "READY_FOR_PICKUP", fulfilment: "PICKUP", items: [["STRAPS-STD", 1]], daysAgo: 3 },
    { buyer: 0, status: "COMPLETED", fulfilment: "PICKUP", items: [["HOOD-IB-L-GRY", 1]], daysAgo: 20 },
    { buyer: 1, status: "REFUNDED", fulfilment: "PICKUP", items: [["TEE-IB-L-BLK", 1]], daysAgo: 15 },
    { buyer: 2, status: "PAID", fulfilment: "SHIPPING", items: [["CREA-300", 1], ["STRAPS-STD", 1]], daysAgo: 0 },
  ] as const;
  for (const spec of orderSpecs) {
    const buyer = buyers[spec.buyer];
    const discount = buyer.email.startsWith("charlotte") || buyer.email.startsWith("priya") ? 10 : 5;
    const lines = [];
    for (const [sku, qty] of spec.items) {
      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku }, include: { product: true } });
      const lineTotal = Math.round(variant.priceCents * qty * (1 - discount / 100));
      lines.push({ variant, qty, lineTotal });
    }
    const subtotal = lines.reduce((s, l) => s + l.variant.priceCents * l.qty, 0);
    const afterDiscount = lines.reduce((s, l) => s + l.lineTotal, 0);
    const shipping = spec.fulfilment === "SHIPPING" && afterDiscount < 10000 ? 1000 : 0;
    const total = afterDiscount + shipping;
    const created = daysAgo(spec.daysAgo);
    const order = await prisma.order.create({
      data: {
        memberId: buyer.id,
        email: buyer.email,
        customerName: buyer.name ?? buyer.email,
        status: spec.status,
        fulfilment: spec.fulfilment,
        subtotalCents: subtotal,
        discountCents: subtotal - afterDiscount,
        discountPercent: discount,
        shippingCents: shipping,
        totalCents: total,
        gstCents: gstFromInclusive(total),
        stockCommitted: true,
        createdAt: created,
        paidAt: created,
        shippingAddress: spec.fulfilment === "SHIPPING" ? { line1: "4 Example Street", suburb: "Newtown", state: "NSW", postcode: "2042" } : undefined,
        items: {
          create: lines.map((l) => ({
            variantId: l.variant.id,
            productName: l.variant.product.name,
            variantLabel: [l.variant.size, l.variant.colour, l.variant.flavour].filter(Boolean).join(", ") || "Standard",
            category: l.variant.product.category,
            unitPriceCents: l.variant.priceCents,
            quantity: l.qty,
            lineTotalCents: l.lineTotal,
          })),
        },
        events: { create: [{ status: "PAID", actorName: "Stripe", createdAt: created }, ...(spec.status !== "PAID" ? [{ status: spec.status, actorName: "Aisha Rahman" }] : [])] },
      },
    });
    const payment = await prisma.payment.create({
      data: {
        memberId: buyer.id,
        amount: total,
        gstCents: gstFromInclusive(total),
        currency: "aud",
        status: spec.status === "REFUNDED" ? "refunded" : "succeeded",
        description: `Shop order #${order.number}`,
        kind: "SHOP",
        orderId: order.id,
        refundedCents: spec.status === "REFUNDED" ? total : 0,
        createdAt: created,
        paidAt: created,
      },
    });
    if (spec.status === "REFUNDED") {
      await prisma.refund.create({
        data: { paymentId: payment.id, amountCents: total, gstCents: gstFromInclusive(total), reason: "Wrong size, returned unworn", method: "MANUAL", staffName: "Tom Nguyen", createdAt: daysAgo(14) },
      });
    }
  }
}
