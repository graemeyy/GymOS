import { PrismaClient } from "@prisma/client";

const PLAN_PRICES: Record<string, number> = {
  BASIC: 2900,
  PREMIUM: 4900,
  PLATINUM: 9900,
  ELITE: 19900,
};

function daysAgo(days: number, hours = 0, minutes = 0): Date {
  return new Date(Date.now() - (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000);
}

const MEMBERS = [
  { name: "Alex Rivera", email: "alex.rivera@example.com", plan: "PLATINUM", status: "ACTIVE", retentionScore: 96, lastCheckIn: daysAgo(0, 0, 2), keycardIssued: true, visitsPerWeek: 5 },
  { name: "Sarah Chen", email: "sarah.chen@example.com", plan: "PLATINUM", status: "ACTIVE", retentionScore: 91, lastCheckIn: daysAgo(0, 0, 15), keycardIssued: true, visitsPerWeek: 5 },
  { name: "James Wilson", email: "james.wilson@example.com", plan: "BASIC", status: "ACTIVE", retentionScore: 88, lastCheckIn: daysAgo(0, 0, 45), keycardIssued: true, visitsPerWeek: 4 },
  { name: "Emma Thompson", email: "emma.thompson@example.com", plan: "PREMIUM", status: "PAST_DUE", retentionScore: 54, lastCheckIn: daysAgo(1), keycardIssued: true, visitsPerWeek: 2, notes: "Payment failed on last attempt" },
  { name: "Marcus Wright", email: "marcus.wright@example.com", plan: "PREMIUM", status: "ACTIVE", retentionScore: 82, lastCheckIn: daysAgo(0, 3), keycardIssued: true, visitsPerWeek: 4 },
  { name: "David Miller", email: "david.miller@example.com", plan: "BASIC", status: "ACTIVE", retentionScore: 31, lastCheckIn: daysAgo(14), keycardIssued: true, visitsPerWeek: 1, notes: "Churn risk: declining attendance" },
  { name: "Elena Rodriguez", email: "elena.rodriguez@example.com", plan: "PREMIUM", status: "ACTIVE", retentionScore: 38, lastCheckIn: daysAgo(10), keycardIssued: true, visitsPerWeek: 1 },
  { name: "Priya Patel", email: "priya.patel@example.com", plan: "ELITE", status: "ACTIVE", retentionScore: 97, lastCheckIn: daysAgo(0, 1), keycardIssued: true, visitsPerWeek: 6 },
  { name: "Tyler Brooks", email: "tyler.brooks@example.com", plan: "BASIC", status: "CANCELED", retentionScore: 12, lastCheckIn: daysAgo(60), keycardIssued: false, visitsPerWeek: 0 },
  { name: "Nina Okafor", email: "nina.okafor@example.com", plan: "PLATINUM", status: "ACTIVE", retentionScore: 79, lastCheckIn: daysAgo(0, 4), keycardIssued: true, visitsPerWeek: 3 },
  { name: "Jordan Casey", email: "jordan.casey@example.com", plan: "BASIC", status: "PAUSED", retentionScore: 45, lastCheckIn: daysAgo(20), keycardIssued: true, visitsPerWeek: 0 },
  { name: "Michael Zhang", email: "michael.zhang@example.com", plan: "PREMIUM", status: "ACTIVE", retentionScore: 90, lastCheckIn: daysAgo(0, 0, 30), keycardIssued: true, visitsPerWeek: 5 },
  { name: "Grace Kim", email: "grace.kim@example.com", plan: "ELITE", status: "ACTIVE", retentionScore: 85, lastCheckIn: daysAgo(0, 5), keycardIssued: true, visitsPerWeek: 4 },
  { name: "Diego Martinez", email: "diego.martinez@example.com", plan: "BASIC", status: "ACTIVE", retentionScore: 67, lastCheckIn: daysAgo(2), keycardIssued: true, visitsPerWeek: 2 },
  { name: "Olivia Brown", email: "olivia.brown@example.com", plan: "PREMIUM", status: "ACTIVE", retentionScore: 93, lastCheckIn: daysAgo(0, 0, 20), keycardIssued: true, visitsPerWeek: 5 },
  { name: "Ryan O'Connell", email: "ryan.oconnell@example.com", plan: "BASIC", status: "ACTIVE", retentionScore: 58, lastCheckIn: daysAgo(7), keycardIssued: true, visitsPerWeek: 2 },
  { name: "Fatima Al-Sayed", email: "fatima.alsayed@example.com", plan: "PLATINUM", status: "ACTIVE", retentionScore: 71, lastCheckIn: daysAgo(1), keycardIssued: true, visitsPerWeek: 3 },
  { name: "Chris Taylor", email: "chris.taylor@example.com", plan: "PREMIUM", status: "PAST_DUE", retentionScore: 48, lastCheckIn: daysAgo(3), keycardIssued: true, visitsPerWeek: 2 },
];

const EQUIPMENT = [
  { name: "Treadmill #4", serialNumber: "TM-2021-004", status: "OFFLINE", healthScore: 0.12, failureProbability: 0.91, lastServicedAt: daysAgo(60), partNeeded: "Drive Belt V-22", estimatedCost: 14500 },
  { name: "Cable Crossover (Left)", serialNumber: "CC-2019-011", status: "WARNING", healthScore: 0.58, failureProbability: 0.42, lastServicedAt: daysAgo(40), partNeeded: "Steel Coated Cable 3.5m", estimatedCost: 8900 },
  { name: "Concept2 Rower #2", serialNumber: "RW-2020-002", status: "OPERATIONAL", healthScore: 0.95, failureProbability: 0.03, lastServicedAt: daysAgo(10), partNeeded: null, estimatedCost: null },
  { name: "Power Rack A", serialNumber: "PR-2018-001", status: "OPERATIONAL", healthScore: 0.99, failureProbability: 0.01, lastServicedAt: daysAgo(5), partNeeded: null, estimatedCost: null },
  { name: "Squat Rack B", serialNumber: "SR-2018-002", status: "OPERATIONAL", healthScore: 0.88, failureProbability: 0.08, lastServicedAt: daysAgo(25), partNeeded: null, estimatedCost: null },
  { name: "Spin Bike #7", serialNumber: "SB-2021-007", status: "WARNING", healthScore: 0.62, failureProbability: 0.35, lastServicedAt: daysAgo(50), partNeeded: "Resistance belt", estimatedCost: 4200 },
  { name: "Leg Press Machine", serialNumber: "LP-2019-003", status: "OPERATIONAL", healthScore: 0.93, failureProbability: 0.04, lastServicedAt: daysAgo(15), partNeeded: null, estimatedCost: null },
];

export async function seedDatabase(prisma: PrismaClient) {
  const memberRecords = [];
  for (const m of MEMBERS) {
    const record = await prisma.member.upsert({
      where: { email: m.email },
      update: {
        name: m.name,
        plan: m.plan as any,
        status: m.status as any,
        lastCheckIn: m.lastCheckIn,
        retentionScore: m.retentionScore,
        keycardIssued: m.keycardIssued,
        notes: (m as any).notes ?? null,
      },
      create: {
        name: m.name,
        email: m.email,
        plan: m.plan as any,
        status: m.status as any,
        lastCheckIn: m.lastCheckIn,
        retentionScore: m.retentionScore,
        keycardIssued: m.keycardIssued,
        notes: (m as any).notes ?? null,
      },
    });
    memberRecords.push({ record, visitsPerWeek: m.visitsPerWeek, lastCheckIn: m.lastCheckIn });
  }

  // Replace check-ins and payouts wholesale each run — this is sample data, not
  // real history, so there's no upsert key worth preserving between reseeds.
  await prisma.checkIn.deleteMany({});
  await prisma.payout.deleteMany({});
  await prisma.equipment.deleteMany({});

  let checkInCount = 0;
  for (const { record, visitsPerWeek, lastCheckIn } of memberRecords) {
    const visits = Math.round((visitsPerWeek / 7) * 14);
    for (let i = 0; i < visits; i++) {
      const offsetDays = (i / Math.max(visits - 1, 1)) * 13;
      const timestamp = new Date(lastCheckIn.getTime() - offsetDays * 24 * 60 * 60 * 1000);
      await prisma.checkIn.create({
        data: {
          memberId: record.id,
          location: Math.random() < 0.85 ? "Main Entrance" : "Weight Room",
          timestamp,
        },
      });
      checkInCount++;
    }
  }

  let payoutCount = 0;
  const payingMembers = memberRecords.filter((m) => m.record.status === "ACTIVE" || m.record.status === "PAST_DUE");
  for (const { record } of payingMembers) {
    const monthsBack = Math.random() < 0.7 ? 2 : 3;
    for (let i = 0; i < monthsBack; i++) {
      const isLatest = i === 0;
      await prisma.payout.create({
        data: {
          memberId: record.id,
          amount: PLAN_PRICES[record.plan] ?? 2900,
          currency: "usd",
          status: isLatest && record.status === "PAST_DUE" ? "failed" : "succeeded",
          createdAt: daysAgo(i * 30 + Math.floor(Math.random() * 3)),
        },
      });
      payoutCount++;
    }
  }

  for (const e of EQUIPMENT) {
    await prisma.equipment.create({ data: e as any });
  }

  return {
    members: memberRecords.length,
    checkIns: checkInCount,
    payouts: payoutCount,
    equipment: EQUIPMENT.length,
  };
}
