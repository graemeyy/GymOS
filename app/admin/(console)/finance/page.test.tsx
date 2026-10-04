// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import FinancePage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const summary = {
  label: "October 2026",
  periods: [{ key: "this-month", label: "This month" }],
  grossCents: 100_00,
  gstCollectedCents: 9_09,
  refundsCents: 0,
  refundsGstCents: 0,
  netCents: 100_00,
  netGstCents: 9_09,
  paymentCount: 1,
  byPlan: [],
  byProduct: [],
  outstanding: [],
  outstandingTotalCents: 0,
  otherCurrency: [],
};

describe("R-88 scoreboard alerts", () => {
  it("doesn't highlight $0 owed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(summary), { status: 200 })));
    render(<FinancePage />);
    const owed = (await screen.findByText("Owed by members")).closest("div")!.querySelector("dd span")!;
    expect(owed.textContent).toBe("$0");
    expect(owed.className).not.toContain("text-chalk");
  });
});
