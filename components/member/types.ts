import type { STATUS_TEXT } from "@/lib/client/labels";
import type { INTERVAL_LABELS } from "@/lib/money";

export type Interval = keyof typeof INTERVAL_LABELS;

export interface Me {
  id: string;
  name: string | null;
  email: string;
  status: keyof typeof STATUS_TEXT;
  createdAt: string;
  onboardedAt: string | null;
  currentPeriodEnd: string | null;
  pausedFrom: string | null;
  pausedUntil: string | null;
  cancelAt: string | null;
  cancelledAt: string | null;
  amountOwingCents: number;
  notifyAnnouncements: boolean;
  notifyWaitlist: boolean;
  hasCardOnFile: boolean;
  billedOnline: boolean;
  membershipPlan: { id: string; slug: string; name: string; priceCents: number; interval: Interval; shopDiscountPercent: number } | null;
  pendingPlan: { id: string; name: string; priceCents: number; interval: Interval } | null;
  benefits: { classCreditsPerCycle: number | null; guestPassesPerCycle: number; shopDiscountPercent: number; guestRateCents: number };
  usage: { classCreditsRemaining: number | null; guestPassesRemaining: number | null; cycleEnd: string | null };
  outstandingAcceptances: ("TERMS" | "PRIVACY")[];
}
