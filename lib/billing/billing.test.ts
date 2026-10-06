import { describe, expect, it } from "vitest";
import { gym } from "@/lib/config";
import { refundGst } from "./refunds";
import { buildTaxInvoice } from "./invoice";
import { withinGracePeriod } from "./reminders";
import { stripeRecurring } from "./intervals";

describe("refund GST", () => {
  it("is the same share of the payment's GST", () => {
    expect(refundGst({ amount: 3995, gstCents: 363 }, 0, 3995)).toBe(363);
    expect(refundGst({ amount: 3995, gstCents: 363 }, 0, 1000)).toBe(91);
    expect(refundGst({ amount: 0, gstCents: 0 }, 0, 0)).toBe(0);
    // Partial refunds add up to the GST collected (R-17).
    expect(refundGst({ amount: 2000, gstCents: 182 }, 0, 500) + refundGst({ amount: 2000, gstCents: 182 }, 500, 1500)).toBe(182);
  });
});

describe("tax invoice", () => {
  it("carries everything an Australian tax invoice needs", () => {
    const inv = buildTaxInvoice({ invoiceNumber: 42, paidAt: new Date("2026-10-01T00:00:00Z"), amount: 2995, gstCents: 272, refundedCents: 0, currency: "aud", description: null, planName: "Standard", member: { name: "Jack O'Sullivan", email: "jack@example.com" } });
    expect(inv).toMatchObject({
      title: "Tax invoice",
      number: "INV-000042",
      seller: { abn: gym.business.abn },
      buyer: { name: "Jack O'Sullivan" },
      totalCents: 2995,
      gstCents: 272,
      lines: [{ description: "Standard membership", quantity: 1, amountCents: 2995 }],
      note: "Total price includes GST.",
    });
  });
});

describe("failed-payment grace period (config: 7 days)", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  it("lets a member in for 7 days after a failed payment", () => {
    expect(withinGracePeriod(new Date("2026-10-05T00:00:00Z"), now)).toBe(true);
    expect(withinGracePeriod(new Date("2026-10-03T00:00:00Z"), now)).toBe(false);
    expect(withinGracePeriod(null, now)).toBe(false);
  });
});

describe("Stripe billing intervals", () => {
  it("maps fortnightly to two weeks", () => {
    expect(stripeRecurring("FORTNIGHT")).toEqual({ interval: "week", interval_count: 2 });
    expect(stripeRecurring("YEAR")).toEqual({ interval: "year", interval_count: 1 });
  });
});
