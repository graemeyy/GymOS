// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "o1" }),
  usePathname: () => "/member/orders/o1",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const { default: MyOrderPage } = await import("./page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const order = {
  id: "o1",
  number: 1001,
  status: "PAID",
  fulfilment: "PICKUP",
  subtotalCents: 1500,
  discountCents: 0,
  discountPercent: 0,
  shippingCents: 0,
  totalCents: 1500,
  gstCents: 136,
  shippingAddress: null,
  trackingNumber: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  items: [],
  events: [],
  payment: null,
  pickupAddress: { line1: "1 Example St", suburb: "Fitzroy", state: "VIC", postcode: "3065" },
  changeOfMindReturnsDays: 0,
};

describe("R-50 back from Stripe", () => {
  it("clears the cart once and drops ?paid=1 from the address", async () => {
    window.history.pushState(null, "", "/member/orders/o1?paid=1");
    window.localStorage.setItem("gymos-cart-v1", JSON.stringify([{ variantId: "v1", quantity: 1 }]));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(order), { status: 200 })));
    render(<MyOrderPage />);
    await waitFor(() => expect(screen.getByText(/your order is confirmed/)).toBeTruthy());
    expect(window.localStorage.getItem("gymos-cart-v1")).toBe("[]");
    expect(window.location.search).toBe("");
  });
});
