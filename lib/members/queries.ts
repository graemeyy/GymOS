import type { Prisma } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import type { MemberListInput } from "./schema";

// Fields staff lists may show. Never includes passwordHash or sessionVersion.
export const memberListSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  planId: true,
  membershipPlan: { select: { id: true, name: true, slug: true } },
  lastCheckIn: true,
  retentionScore: true,
  referredById: true,
  archivedAt: true,
  createdAt: true,
} satisfies Prisma.MemberSelect;

// Searching by email is only for viewers who can see emails; otherwise a
// search would confirm whether an address belongs to a member.
export async function listMembers(db: Db, query: MemberListInput, opts: { searchEmail?: boolean } = { searchEmail: true }) {
  const where: Prisma.MemberWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.planId ? { planId: query.planId } : {}),
    ...(query.archived === "exclude" ? { archivedAt: null } : query.archived === "only" ? { archivedAt: { not: null } } : {}),
    ...(query.q
      ? opts.searchEmail === false
        ? { name: { contains: query.q, mode: "insensitive" } }
        : { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] }
      : {}),
  };
  const rows = await db.member.findMany({
    where,
    select: memberListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.take;
  const items = hasMore ? rows.slice(0, query.take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export function getMemberListItem(db: Db | Tx, memberId: string) {
  return db.member.findUniqueOrThrow({ where: { id: memberId }, select: memberListSelect });
}

// The staff member page. Payments are only loaded for staff who may see
// revenue.
export function getMemberDetail(db: Db, memberId: string, opts: { showPayments: boolean; now: Date }) {
  return db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      planId: true,
      membershipPlan: { select: { id: true, name: true, priceCents: true, interval: true } },
      pendingPlan: { select: { id: true, name: true } },
      currentPeriodStart: true,
      currentPeriodEnd: true,
      pausedFrom: true,
      pausedUntil: true,
      cancelAt: true,
      cancelledAt: true,
      cancelReason: true,
      pastDueSince: true,
      amountOwingCents: true,
      lastFailedInvoiceId: true,
      stripeSubscriptionId: true,
      keycardIssued: true,
      lastCheckIn: true,
      retentionScore: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      checkIns: { orderBy: { timestamp: "desc" }, take: 20, select: { id: true, location: true, timestamp: true } },
      payments: opts.showPayments
        ? {
            orderBy: { paidAt: "desc" },
            take: 20,
            select: { id: true, amount: true, gstCents: true, currency: true, status: true, paidAt: true, invoiceNumber: true, refundedCents: true, kind: true, description: true },
          }
        : false,
      classBookings: {
        where: { class: { startTime: { gte: opts.now } } },
        orderBy: { class: { startTime: "asc" } },
        select: { id: true, class: { select: { id: true, name: true, startTime: true, instructor: true } } },
      },
      classWaitlist: {
        where: { class: { startTime: { gte: opts.now } } },
        orderBy: { class: { startTime: "asc" } },
        select: { id: true, class: { select: { id: true, name: true, startTime: true } } },
      },
      referredBy: { select: { id: true, name: true, email: true } },
      referrals: { select: { id: true, name: true, email: true, createdAt: true } },
    },
  });
}

export function listMemberNotes(db: Db, memberId: string) {
  return db.memberNote.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 100 });
}

// The signed-in member's own record, without anything only staff should see.
export function getMemberProfile(db: Db, memberId: string) {
  return db.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      onboardedAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      currentPeriodEnd: true,
      pausedFrom: true,
      pausedUntil: true,
      cancelAt: true,
      cancelledAt: true,
      amountOwingCents: true,
      notifyAnnouncements: true,
      notifyWaitlist: true,
      membershipPlan: { select: { id: true, slug: true, name: true, priceCents: true, interval: true, classCreditsPerCycle: true, guestPassesPerCycle: true, shopDiscountPercent: true, guestRateCents: true } },
      pendingPlan: { select: { id: true, name: true, priceCents: true, interval: true } },
    },
  });
}

export function getMemberPassDetails(db: Db, memberId: string) {
  return db.member.findUniqueOrThrow({ where: { id: memberId }, select: { qrVersion: true, status: true, name: true } });
}
