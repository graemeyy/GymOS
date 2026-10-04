import type { PrismaClient, Status } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { gstFromInclusive } from "../lib/money";
import { syncPlansFromConfig } from "../lib/plans";

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
];

const CLASSES = [
  { name: "Barbell Basics", instructor: "Lachie Brennan", day: 0, hourUtc: 20, durationMinutes: 60, capacity: 10 },
  { name: "Conditioning", instructor: "Lachie Brennan", day: 1, hourUtc: 7, durationMinutes: 45, capacity: 16 },
  { name: "Mobility", instructor: "Tom Nguyen", day: 1, hourUtc: 22, durationMinutes: 45, capacity: 12 },
  { name: "Strongman Saturday", instructor: "Lachie Brennan", day: 3, hourUtc: 22, durationMinutes: 75, capacity: 8 },
  { name: "Conditioning", instructor: "Lachie Brennan", day: 4, hourUtc: 7, durationMinutes: 45, capacity: 16 },
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
    prisma.auditLog.deleteMany(),
    prisma.classWaitlist.deleteMany(),
    prisma.classBooking.deleteMany(),
    prisma.class.deleteMany(),
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
    const joined = daysAgo(400 - i * 25);
    const member = await prisma.member.create({
      data: {
        name: m.name,
        email: m.email,
        status: m.status,
        planId: plan?.id ?? null,
        retentionScore: m.retentionScore,
        lastCheckIn: m.lastSeenDays === null ? null : daysAgo(m.lastSeenDays, 2),
        keycardIssued: m.status !== "CANCELED",
        notes: m.notes ?? null,
        passwordHash: m.login ? passwordHash : null,
        createdAt: joined,
      },
    });
    memberIds.push(member.id);

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
            createdAt: daysAgo(w * 7 + (m.status === "PAST_DUE" ? 14 : 0) + 1),
          },
        });
      }
    }
  }

  // Referrals: a couple of members brought friends in.
  await prisma.member.update({ where: { id: memberIds[2] }, data: { referredById: memberIds[0] } });
  await prisma.member.update({ where: { id: memberIds[6] }, data: { referredById: memberIds[0] } });

  for (const [i, c] of CLASSES.entries()) {
    const cls = await prisma.class.create({
      data: { name: c.name, instructor: c.instructor, startTime: inDays(c.day, c.hourUtc), durationMinutes: c.durationMinutes, capacity: c.capacity },
    });
    const active = memberIds.filter((_, idx) => DEMO_MEMBERS[idx].status === "ACTIVE");
    const take = i === 3 ? c.capacity : Math.min(active.length, 3 + i);
    for (const memberId of active.slice(0, take)) {
      await prisma.classBooking.create({ data: { classId: cls.id, memberId } });
    }
  }

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
