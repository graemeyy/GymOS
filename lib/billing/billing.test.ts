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

describe("GST registration changing later (R-73, D-121)", () => {
  const base = { invoiceNumber: 7, paidAt: new Date("2026-01-01T00:00:00Z"), refundedCents: 0, currency: "aud", description: null, planName: "Standard", member: { name: "Sam", email: "sam@example.com" } };
  it("an invoice follows the GST recorded on the payment, not today's setting", () => {
    expect(buildTaxInvoice({ ...base, amount: 2995, gstCents: 272 })).toMatchObject({ title: "Tax invoice", gstCents: 272, note: "Total price includes GST." });
    expect(buildTaxInvoice({ ...base, amount: 2995, gstCents: 0 })).toMatchObject({ title: "Receipt", gstCents: 0, note: "No GST has been charged." });
  });
  it("a refund takes back the GST the payment had, and none when it had none", () => {
    expect(refundGst({ amount: 2995, gstCents: 272 }, 0, 2995)).toBe(272);
    expect(refundGst({ amount: 2995, gstCents: 0 }, 0, 2995)).toBe(0);
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
