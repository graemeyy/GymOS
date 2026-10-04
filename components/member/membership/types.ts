import type { Interval } from "@/components/member/types";

export interface PlanOption {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: Interval;
  current: boolean;
  pending: boolean;
  change: { upgrade: boolean; immediate: boolean; effectiveAt: string; prorationCents: number | null } | null;
}

export interface Options {
  hasMembership: boolean;
  selfServe: boolean;
  plans: PlanOption[];
  cancellation: { allowed: boolean; scheduledFor: string | null; preview: { effectiveAt: string; reason: "cooling_off" | "notice" | "minimum_term" | "immediate" } | null; noticeDays: number; coolingOffDays: number; minimumTermWeeks: number };
  pause: { allowed: boolean; current: { from: string; until: string } | null; minDays: number; maxDays: number; maxPausesPerYear: number; pausesUsed: number; feeCents: number };
}

export interface Payment {
  id: string;
  invoiceNumber: number;
  amount: number;
  refundedCents: number;
  description: string | null;
  paidAt: string;
  status: string;
}
