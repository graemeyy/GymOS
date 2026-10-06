import type { MemberStatus } from "@/lib/members/labels";
import type { Interval } from "@/lib/money";

export type { Interval };

export interface MemberDetail {
  id: string;
  name: string | null;
  email: string;
  status: MemberStatus;
  planId: string | null;
  membershipPlan: { id: string; name: string; priceCents: number; interval: Interval; locationAccess: "HOME" | "SELECTED" | "ALL" } | null;
  homeLocation: { id: string; name: string } | null;
  pendingPlan: { id: string; name: string } | null;
  nextBillingDate: string | null;
  pausedFrom: string | null;
  pausedUntil: string | null;
  cancelAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  pastDueSince: string | null;
  amountOwingCents: number | null;
  hasSubscription: boolean;
  canRetryPayment: boolean;
  keycardIssued: boolean;
  lastCheckIn: string | null;
  retentionScore: number;
  archivedAt: string | null;
  createdAt: string;
  checkIns: { id: string; location: string; site: { id: string; name: string } | null; timestamp: string }[];
  payments:
    | { id: string; amount: number; gstCents: number; refundedCents: number; currency: string; status: string; paidAt: string; invoiceNumber: number; kind: string; description: string | null }[]
    | null;
  classBookings: { id: string; class: { id: string; name: string; startTime: string; instructor: string | null } }[];
  classWaitlist: { id: string; class: { id: string; name: string; startTime: string } }[];
  referredBy: { id: string; name: string | null; email: string } | null;
  referrals: { id: string; name: string | null; email: string; createdAt: string }[];
}

export interface PlanOptionFull {
  id: string;
  name: string;
  priceCents: number;
  interval: Interval;
  active: boolean;
}
