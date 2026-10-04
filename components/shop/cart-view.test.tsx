// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Catalogue } from "@/lib/shop/catalogue";
import { CartView } from "./cart-view";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const catalogue: Catalogue = {
  discountPercent: 0,
  signedIn: true,
  shipping: { pickupOnly: true, flatCents: 0, freeOverCents: null },
  changeOfMindReturnsDays: 0,
  products: [
    {
      id: "p1",
      slug: "chalk",
      name: "Chalk",
      description: null,
      category: "ACCESSORIES",
      imageUrl: null,
      variants: [{ id: "v1", label: "Standard", priceCents: 1500, available: true, lowStock: true, maxQuantity: 2 }],
    },
  ],
};

describe("R-49 stock dropping below the cart quantity", () => {
  it("lets the member pick the available quantity and check out", async () => {
    window.localStorage.setItem("gymos-cart-v1", JSON.stringify([{ variantId: "v1", quantity: 5 }]));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(catalogue), { status: 200 })));
    render(<CartView />);
    await waitFor(() => expect(screen.getByText("Only 2 available.")).toBeTruthy());
    expect((screen.getByRole("button", { name: /^Pay/ }) as HTMLButtonElement).disabled).toBe(true);

    // Browsers only fire "change" when the selection differs from what's
    // shown, so the select must show the real quantity, not the clamped one.
    const select = screen.getByLabelText("Quantity of Chalk") as HTMLSelectElement;
    expect(select.value).toBe("5");
    fireEvent.change(select, { target: { value: "2" } });

    expect(JSON.parse(window.localStorage.getItem("gymos-cart-v1")!)).toEqual([{ variantId: "v1", quantity: 2 }]);
    expect(screen.queryByText("Only 2 available.")).toBeNull();
    expect((screen.getByRole("button", { name: /^Pay/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
