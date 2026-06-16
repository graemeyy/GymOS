import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding GymOS Database...');

  // 1. Seed Members
  const members = [
    {
      name: 'Alex Rivera',
      email: 'alex@example.com',
      plan: 'PLATINUM',
      status: 'ACTIVE',
      lastCheckIn: new Date(Date.now() - 2 * 60 * 1000), // 2 mins ago
      notes: 'Active since Jan 2024',
    },
    {
      name: 'Sarah Chen',
      email: 'sarah.c@example.com',
      plan: 'PLATINUM',
      status: 'ACTIVE',
      lastCheckIn: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
    },
    {
      name: 'James Wilson',
      email: 'j.wilson@example.com',
      plan: 'BASIC',
      status: 'ACTIVE',
      lastCheckIn: new Date(Date.now() - 45 * 60 * 1000), // 45 mins ago
    },
    {
      name: 'Emma Thompson',
      email: 'emma.t@example.com',
      plan: 'PREMIUM',
      status: 'PAST_DUE',
      lastCheckIn: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      notes: 'Payment failed on last attempt',
    },
    {
      name: 'Marcus Wright',
      email: 'm.wright@example.com',
      plan: 'PREMIUM',
      status: 'ACTIVE',
      lastCheckIn: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    },
    {
      name: 'David Miller',
      email: 'david.m@example.com',
      plan: 'BASIC',
      status: 'ACTIVE',
      lastCheckIn: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      notes: 'Churn risk: declining attendance',
    },
    {
      name: 'Elena Rodriguez',
      email: 'elena.r@example.com',
      plan: 'PREMIUM',
      status: 'ACTIVE',
      lastCheckIn: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    },
  ];

  for (const m of members) {
    await prisma.member.upsert({
      where: { email: m.email },
      update: {
        name: m.name,
        plan: m.plan as any,
        status: m.status as any,
        lastCheckIn: m.lastCheckIn,
        notes: m.notes,
      },
      create: {
        name: m.name,
        email: m.email,
        plan: m.plan as any,
        status: m.status as any,
        lastCheckIn: m.lastCheckIn,
        notes: m.notes,
      },
    });
  }

  // 2. Seed Equipment
  const equipment = [
    {
      name: 'Technogym Treadmill #4',
      status: 'OFFLINE',
      partNeeded: 'Drive Belt V-22',
      estimatedCost: 14500, // $145.00
    },
    {
      name: 'Cable Crossover (Left)',
      status: 'WARNING',
      partNeeded: 'Steel Coated Cable 3.5m',
      estimatedCost: 8900,
    },
    {
      name: 'Concept2 Rower #2',
      status: 'OPERATIONAL',
      partNeeded: 'Chain Lube / Replacement',
      estimatedCost: 1200,
    },
  ];

  for (const e of equipment) {
    await prisma.equipment.create({
      data: e as any,
    });
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
