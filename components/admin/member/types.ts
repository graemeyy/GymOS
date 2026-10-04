import type { MemberStatus } from "@/lib/client/labels";
import type { INTERVAL_LABELS } from "@/lib/money";

export type Interval = keyof typeof INTERVAL_LABELS;

export interface MemberDetail {
  id: string;
  name: string | null;
  email: string;
  status: MemberStatus;
  planId: string | null;
  membershipPlan: { id: string; name: string; priceCents: number; interval: Interval } | null;
  pendingPlan: { id: string; name: string } | null;
  nextBillingDate: string | null;
  pausedFrom: string | null;
  pausedUntil: string | null;
  cancelAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  pastDueSince: string | null;
  amountOwingCents: number;
  hasSubscription: boolean;
  canRetryPayment: boolean;
  keycardIssued: boolean;
  lastCheckIn: string | null;
  retentionScore: number;
  archivedAt: string | null;
  createdAt: string;
  checkIns: { id: string; location: string; timestamp: string }[];
  payments:
    | { id: string; amount: number; gstCents: number; refundedCents: number; currency: string; status: string; createdAt: string; invoiceNumber: number; kind: string; description: string | null }[]
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
