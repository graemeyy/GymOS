import type { PrismaClient, ProductCategory, Status } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { gstFromInclusive } from "../lib/money";
import { syncPlansFromConfig } from "../lib/plans";
import { gym } from "../lib/config";

// Fictional data only. Every name, email and number below is made up; emails
// use the reserved example.com domain.

export const DEMO_PASSWORD = "ironbark-demo-2026";

export const DEMO_STAFF = [
  { name: "Mel Hartigan", email: "owner@example.com", role: "OWNER" },
  { name: "Tom Nguyen", email: "manager@example.com", role: "MANAGER" },
  { name: "Aisha Rahman", email: "frontdesk@example.com", role: "FRONT_DESK" },
  { name: "Lachie Brennan", email: "trainer@example.com", role: "TRAINER" },
] as const;

const DAY = 86_400_000;
const daysAgo = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000);

function inDays(days: number, hourUtc: number, minute = 0) {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d;
}

type SeedMember = {
  name: string;
  email: string;
  plan: string;
  status: Status;
  retentionScore: number;
  lastSeenDays: number | null;
  visitsPerWeek: number;
  login?: boolean;
  notes?: string;
};

export const DEMO_MEMBERS: SeedMember[] = [
  { name: "Charlotte Pham", email: "charlotte.pham@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 96, lastSeenDays: 0, visitsPerWeek: 5, login: true },
  { name: "Jack O'Sullivan", email: "jack.osullivan@example.com", plan: "standard", status: "ACTIVE", retentionScore: 88, lastSeenDays: 1, visitsPerWeek: 4, login: true },
  { name: "Priya Sharma", email: "priya.sharma@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 91, lastSeenDays: 0, visitsPerWeek: 5 },
  { name: "Mitchell Greaves", email: "mitchell.greaves@example.com", plan: "standard", status: "PAST_DUE", retentionScore: 54, lastSeenDays: 2, visitsPerWeek: 2, notes: "Card declined on last renewal." },
  { name: "Ngaio Tipene", email: "ngaio.tipene@example.com", plan: "off-peak", status: "ACTIVE", retentionScore: 79, lastSeenDays: 1, visitsPerWeek: 3 },
  { name: "Daniel Kowalski", email: "daniel.kowalski@example.com", plan: "standard", status: "ACTIVE", retentionScore: 31, lastSeenDays: 15, visitsPerWeek: 1, notes: "Asked about pausing over summer." },
  { name: "Grace Liu", email: "grace.liu@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 85, lastSeenDays: 0, visitsPerWeek: 4 },
  { name: "Sam Whitlock", email: "sam.whitlock@example.com", plan: "off-peak", status: "CANCELED", retentionScore: 12, lastSeenDays: 60, visitsPerWeek: 0 },
  { name: "Olivia Marchetti", email: "olivia.marchetti@example.com", plan: "standard", status: "PAUSED", retentionScore: 45, lastSeenDays: 21, visitsPerWeek: 0 },
  { name: "Ben Adeyemi", email: "ben.adeyemi@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 93, lastSeenDays: 0, visitsPerWeek: 5 },
  { name: "Tahlia Moore", email: "tahlia.moore@example.com", plan: "standard", status: "ACTIVE", retentionScore: 67, lastSeenDays: 3, visitsPerWeek: 2 },
  { name: "Hamish Fraser", email: "hamish.fraser@example.com", plan: "off-peak", status: "ACTIVE", retentionScore: 58, lastSeenDays: 7, visitsPerWeek: 2 },
  { name: "Mei Tanaka", email: "mei.tanaka@example.com", plan: "unlimited", status: "ACTIVE", retentionScore: 71, lastSeenDays: 1, visitsPerWeek: 3 },
  { name: "Riley Dunstan", email: "riley.dunstan@example.com", plan: "standard", status: "PAST_DUE", retentionScore: 48, lastSeenDays: 4, visitsPerWeek: 2 },
  // Signed up online yesterday and hasn't chosen a plan yet.
  { name: "Oliver Brandt", email: "oliver.brandt@example.com", plan: "", status: "PENDING", retentionScore: 100, lastSeenDays: null, visitsPerWeek: 0, login: true },
];

const CLASSES = [
  { name: "Barbell Basics", instructor: "Lachie Brennan", day: 0, hourUtc: 20, durationMinutes: 60, capacity: 10 },
  { name: "Conditioning", instructor: "Lachie Brennan", day: 1, hourUtc: 7, durationMinutes: 45, capacity: 16 },
  { name: "Mobility", instructor: "Tom Nguyen", day: 1, hourUtc: 22, durationMinutes: 45, capacity: 12 },
  { name: "Strongman", instructor: "Lachie Brennan", day: 3, hourUtc: 22, durationMinutes: 75, capacity: 8 },
  { name: "Conditioning", instructor: "Lachie Brennan", day: 4, hourUtc: 7, durationMinutes: 45, capacity: 16 },
];

const TEMPLATES = [
  { name: "Conditioning", trainer: "Lachie Brennan", weekday: 0, startTime: "06:00", durationMinutes: 45, capacity: 16 },
  { name: "Barbell Basics", trainer: "Lachie Brennan", weekday: 1, startTime: "18:00", durationMinutes: 60, capacity: 10 },
  { name: "Mobility", trainer: "Tom Nguyen", weekday: 2, startTime: "07:00", durationMinutes: 45, capacity: 12 },
  { name: "Conditioning", trainer: "Lachie Brennan", weekday: 3, startTime: "06:00", durationMinutes: 45, capacity: 16 },
  { name: "Strongman", trainer: "Lachie Brennan", weekday: 5, startTime: "09:00", durationMinutes: 75, capacity: 8 },
];

type SeedVariant = { sku: string; priceCents: number; stockQty: number; size?: string; colour?: string; flavour?: string };
const PRODUCTS: { name: string; slug: string; description: string; category: ProductCategory; variants: SeedVariant[] }[] = [
  {
    name: "Ironbark tee",
    slug: "ironbark-tee",
    description: "Heavyweight cotton tee with the plate logo on the chest.",
    category: "APPAREL",
    variants: [
      { sku: "TEE-IB-S-BLK", size: "S", colour: "Black", priceCents: 3500, stockQty: 6 },
      { sku: "TEE-IB-M-BLK", size: "M", colour: "Black", priceCents: 3500, stockQty: 10 },
      { sku: "TEE-IB-L-BLK", size: "L", colour: "Black", priceCents: 3500, stockQty: 8 },
      { sku: "TEE-IB-M-WHT", size: "M", colour: "White", priceCents: 3500, stockQty: 0 },
    ],
  },
  {
    name: "Ironbark hoodie",
    slug: "ironbark-hoodie",
    description: "Midweight fleece hoodie with a kangaroo pocket.",
    category: "APPAREL",
    variants: [
      { sku: "HOOD-IB-M-GRY", size: "M", colour: "Grey", priceCents: 7500, stockQty: 4 },
      { sku: "HOOD-IB-L-GRY", size: "L", colour: "Grey", priceCents: 7500, stockQty: 3 },
    ],
  },
  {
    name: "Whey protein isolate 1 kg",
    slug: "whey-protein-isolate-1kg",
    description: "Whey protein isolate powder. 1 kg bag, about 33 serves. See the label for ingredients, allergens and nutrition information.",
    category: "SUPPLEMENTS",
    variants: [
      { sku: "WPI-1KG-CHOC", flavour: "Chocolate", priceCents: 6995, stockQty: 12 },
      { sku: "WPI-1KG-VAN", flavour: "Vanilla", priceCents: 6995, stockQty: 5 },
    ],
  },
  {
    name: "Creatine monohydrate 300 g",
    slug: "creatine-monohydrate-300g",
    description: "Unflavoured creatine monohydrate powder, 300 g tub. See the label for directions and warnings.",
    category: "SUPPLEMENTS",
    variants: [{ sku: "CREA-300", priceCents: 3995, stockQty: 9 }],
  },
  {
    name: "Lifting straps",
    slug: "lifting-straps",
    description: "Cotton lifting straps, sold as a pair.",
    category: "ACCESSORIES",
    variants: [{ sku: "STRAPS-STD", priceCents: 2500, stockQty: 15 }],
  },
  {
    name: "Chalk block 250 g",
    slug: "chalk-block-250g",
    description: "Magnesium carbonate block chalk.",
    category: "ACCESSORIES",
    variants: [{ sku: "CHALK-250", priceCents: 800, stockQty: 30 }],
  },
];

const EQUIPMENT = [
  { name: "Treadmill 4", serialNumber: "TM-2021-004", status: "OFFLINE", lastServicedAt: daysAgo(60), partNeeded: "Drive belt", estimatedCost: 18900 },
  { name: "Cable crossover (left)", serialNumber: "CC-2019-011", status: "WARNING", lastServicedAt: daysAgo(40), partNeeded: "Coated steel cable, 3.5 m", estimatedCost: 12400 },
  { name: "Rower 2", serialNumber: "RW-2020-002", status: "OPERATIONAL", lastServicedAt: daysAgo(10), partNeeded: null, estimatedCost: null },
  { name: "Power rack A", serialNumber: "PR-2018-001", status: "OPERATIONAL", lastServicedAt: daysAgo(5), partNeeded: null, estimatedCost: null },
  { name: "Assault bike 3", serialNumber: "AB-2022-003", status: "WARNING", lastServicedAt: daysAgo(50), partNeeded: "Fan belt", estimatedCost: 6500 },
] as const;

const INVENTORY = [
  { name: "Chalk block", category: "Consumables", sku: "CON-CHALK", quantity: 40, reorderLevel: 15, unitCostCents: 250 },
  { name: "Disinfectant spray 5 L", category: "Cleaning", sku: "CLN-SPRAY5", quantity: 3, reorderLevel: 4, unitCostCents: 3200 },
  { name: "Paper towel roll", category: "Cleaning", sku: "CLN-TOWEL", quantity: 24, reorderLevel: 12, unitCostCents: 180 },
];

export async function isDatabaseEmpty(prisma: PrismaClient) {
  const [members, staff] = await Promise.all([prisma.member.count(), prisma.staff.count()]);
  return members === 0 && staff === 0;
}

// Wipes only rows the seed itself creates. Used by `npm run db:seed -- --reset`
// against a local database and by the end-to-end test setup.
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
    prisma.payment.deleteMany(),
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
}

export async function seedDatabase(prisma: PrismaClient) {
  await syncPlansFromConfig(prisma);
  const plans = new Map((await prisma.membershipPlan.findMany()).map((p) => [p.slug, p]));
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const s of DEMO_STAFF) {
    await prisma.staff.create({ data: { name: s.name, email: s.email, role: s.role, passwordHash } });
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
        createdAt: joined,
        pastDueSince: m.status === "PAST_DUE" ? daysAgo(m.retentionScore > 50 ? 2 : 9) : null,
        amountOwingCents: m.status === "PAST_DUE" && plan ? plan.priceCents : 0,
        cancelledAt: m.status === "CANCELED" ? daysAgo(12) : null,
        pausedFrom: m.status === "PAUSED" ? daysAgo(10) : null,
        pausedUntil: m.status === "PAUSED" ? new Date(Date.now() + 20 * DAY) : null,
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
  const buyers = await prisma.member.findMany({ where: { email: { in: ["charlotte.pham@example.com", "jack.osullivan@example.com", "priya.sharma@example.com"] } } });
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

  // Goodwill adjustment and an announcement.
  await prisma.benefitLedger.create({ data: { memberId: memberIds[1], kind: "CLASS_CREDIT", delta: 2, reason: "Class cancelled by the gym last week", refType: "adjustment" } });
  await prisma.announcement.create({
    data: {
      title: "Long weekend hours",
      body: "We're open 8am to 12pm on the public holiday Monday. Classes are back to normal on Tuesday.",
      publishedAt: daysAgo(1),
      expiresAt: new Date(Date.now() + 7 * DAY),
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
