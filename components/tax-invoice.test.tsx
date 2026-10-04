// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TaxInvoiceDocument } from "./tax-invoice";

const originalTz = process.env.TZ;
afterEach(() => {
  cleanup();
  process.env.TZ = originalTz;
});

describe("R-54 invoice date", () => {
  it("uses the gym's date whatever the viewer's time zone", () => {
    // A viewer in London: 1 Oct 20:00 UTC is already 2 Oct at the gym in Sydney.
    process.env.TZ = "Europe/London";
    render(
      <TaxInvoiceDocument
        invoice={{
          title: "Tax invoice",
          number: "INV-000001",
          issuedAt: "2026-10-01T20:00:00.000Z",
          seller: { name: "Gym", abn: "00 000 000 000", address: "1 Example St", email: "gym@example.com" },
          buyer: { name: "Member", email: "member@example.com" },
          lines: [],
          totalCents: 0,
          gstCents: 0,
          refundedCents: 0,
          currency: "aud",
          note: "",
        }}
      />
    );
    expect(screen.getByText(/INV-000001, issued/).textContent).toContain("2 October 2026");
  });
});
