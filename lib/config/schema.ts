import { z } from "zod";
import { BODY_FONT_IDS, DISPLAY_FONT_IDS } from "@/lib/branding/fonts";

// ABN check digit rule published by the ATO: subtract 1 from the first digit,
// weight the 11 digits, and the sum must divide by 89.
export function isValidAbn(input: string): boolean {
  const digits = input.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const values = digits.split("").map(Number);
  values[0] -= 1;
  const sum = values.reduce((acc, value, i) => acc + value * weights[i], 0);
  return sum % 89 === 0;
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");
const cents = z.number().int().nonnegative();

import { AU_STATES, BILLING_INTERVALS, DAYS } from "./constants";

export { AU_STATES, BILLING_INTERVALS, DAYS };

export const planBenefitsSchema = z.object({
  // null means unlimited.
  classCreditsPerCycle: z.number().int().nonnegative().nullable(),
  guestPassesPerCycle: z.number().int().nonnegative(),
  shopDiscountPercent: z.number().min(0).max(100),
  guestRateCents: cents,
});

export const planConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  name: z.string().min(1),
  description: z.string().min(1),
  priceCents: cents,
  interval: z.enum(BILLING_INTERVALS),
  benefits: planBenefitsSchema,
});

export const gymConfigSchema = z
  .object({
    $comment: z.string().optional(),
    isDemo: z.boolean(),
    brand: z.object({
      name: z.string().min(1),
      shortName: z.string().min(1).max(20),
      tagline: z.string().min(1),
      logoText: z.string().min(1).max(3),
      // Defaults for the Branding page (D-124); the database overrides them.
      primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour like #1F5AA6"),
      accentColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour like #F2C230"),
      bodyFont: z.enum(BODY_FONT_IDS),
      displayFont: z.enum(DISPLAY_FONT_IDS),
    }),
    business: z.object({
      legalName: z.string().min(1),
      abn: z.string().refine(isValidAbn, "Not a valid ABN (check digits failed)"),
      gstRegistered: z.boolean(),
      email: z.email(),
      phone: z.string().min(8),
      address: z.object({
        line1: z.string().min(1),
        line2: z.string(),
        suburb: z.string().min(1),
        state: z.enum(AU_STATES),
        postcode: z.string().regex(/^\d{4}$/, "Australian postcodes are four digits"),
      }),
      timezone: z.string().refine((tz) => {
        try {
          new Intl.DateTimeFormat("en-AU", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Unknown IANA timezone"),
    }),
    hours: z
      .array(z.object({ day: z.enum(DAYS), open: time, close: time }))
      .refine((rows) => new Set(rows.map((r) => r.day)).size === rows.length, "Each day may appear once"),
    plans: z
      .array(planConfigSchema)
      .min(1)
      .refine((plans) => new Set(plans.map((p) => p.slug)).size === plans.length, "Plan slugs must be unique"),
    policies: z.object({
      cancellation: z.object({
        noticeDays: z.number().int().min(0).max(90),
        minimumTermWeeks: z.number().int().min(0).max(104),
        coolingOffDays: z.number().int().min(0).max(30),
        allowMemberSelfCancel: z.boolean(),
      }),
      pause: z.object({
        allowMemberSelfPause: z.boolean(),
        minDays: z.number().int().min(1),
        maxDays: z.number().int().min(1),
        maxPausesPerYear: z.number().int().min(0),
        // Shown to members and recorded on each pause, but not charged
        // automatically yet: staff collect it at the desk (R-37).
        feeCents: cents,
      }),
      planChanges: z.object({
        upgradeProration: z.enum(["prorate_now", "next_cycle"]),
        downgradeTiming: z.enum(["immediate", "next_cycle"]),
      }),
      failedPayments: z.object({
        reminderDays: z.array(z.number().int().min(0).max(60)).max(5),
        suspendAccessAfterDays: z.number().int().min(0).max(60),
      }),
      classes: z.object({
        bookingOpensDaysAhead: z.number().int().min(0).max(60),
        cancelWithoutPenaltyHours: z.number().int().min(0).max(72),
        lateCancelForfeitsCredit: z.boolean(),
      }),
      shop: z.object({
        pickupOnly: z.boolean(),
        flatShippingCents: cents,
        freeShippingOverCents: cents.nullable(),
        changeOfMindReturnsDays: z.number().int().min(0).max(365),
      }),
      dataRetention: z.object({
        financialRecordsYears: z.number().int().min(5, "Keep financial records for at least five years (ATO)"),
        checkInHistoryMonths: z.number().int().min(1),
        archivedMemberMonths: z.number().int().min(1),
      }),
    }),
    legal: z.object({
      termsVersion: z.string().min(1),
      privacyVersion: z.string().min(1),
      reviewedByLawyer: z.boolean(),
    }),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.policies.pause.minDays > cfg.policies.pause.maxDays) {
      ctx.addIssue({ code: "custom", path: ["policies", "pause", "minDays"], message: "minDays must not exceed maxDays" });
    }
  });

export type GymConfig = z.infer<typeof gymConfigSchema>;
export type PlanConfig = z.infer<typeof planConfigSchema>;
export type PlanBenefits = z.infer<typeof planBenefitsSchema>;
