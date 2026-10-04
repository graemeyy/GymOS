// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CatalogueProduct } from "@/lib/shop/catalogue";
import { AddToCart } from "./add-to-cart";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const product = {
  id: "p1",
  name: "Chalk",
  variants: [{ id: "v1", label: "Standard", priceCents: 1500, available: true, lowStock: false, maxQuantity: 3 }],
} as unknown as CatalogueProduct;

describe("R-48 quantity after adding to the cart", () => {
  it("clamps the chosen quantity to what's left, so the button stays usable", () => {
    render(<AddToCart product={product} discountPercent={0} />);
    const select = screen.getByLabelText("Quantity") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    // One left: the choice is 1 and the button still adds it.
    const after = screen.getByLabelText("Quantity") as HTMLSelectElement;
    expect(after.value).toBe("1");
    const button = screen.getByRole("button", { name: "Add to cart" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(JSON.parse(window.localStorage.getItem("gymos-cart-v1")!)).toEqual([{ variantId: "v1", quantity: 3 }]);
  });

  it("explains why it can't add more once the cart holds everything available", () => {
    window.localStorage.setItem("gymos-cart-v1", JSON.stringify([{ variantId: "v1", quantity: 3 }]));
    render(<AddToCart product={product} discountPercent={0} />);
    expect(screen.getByText("You have all that's available in your cart.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add to cart" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
