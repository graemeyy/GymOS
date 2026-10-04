import { describe, expect, it } from "vitest";
import { allowedTransitions, priceOrder } from "./orders";
import { claimWarnings, slugify } from "./products";
import { variantLabel } from "./labels";

describe("order pricing (GST-inclusive, config: $10 shipping, free over $100)", () => {
  it("applies the member discount per line and works out GST on the total", () => {
    const p = priceOrder([{ variantId: "a", quantity: 2, unitPriceCents: 3500 }], 10, "PICKUP");
    expect(p).toMatchObject({ subtotalCents: 7000, discountCents: 700, shippingCents: 0, totalCents: 6300, gstCents: 573 });
  });
  it("adds shipping under the free-shipping threshold and not over it", () => {
    expect(priceOrder([{ variantId: "a", quantity: 1, unitPriceCents: 6995 }], 0, "SHIPPING").shippingCents).toBe(1000);
    expect(priceOrder([{ variantId: "a", quantity: 2, unitPriceCents: 6995 }], 0, "SHIPPING").shippingCents).toBe(0);
  });
  it("totals always add up", () => {
    const p = priceOrder([{ variantId: "a", quantity: 3, unitPriceCents: 999 }, { variantId: "b", quantity: 1, unitPriceCents: 4995 }], 5, "SHIPPING");
    expect(p.subtotalCents - p.discountCents + p.shippingCents).toBe(p.totalCents);
  });
});

describe("order status transitions", () => {
  it("only allows sensible next steps for the fulfilment method", () => {
    expect(allowedTransitions("PAID", "PICKUP")).toEqual(["PACKED", "CANCELLED"]);
    expect(allowedTransitions("PACKED", "PICKUP")).toEqual(["READY_FOR_PICKUP", "PAID"]);
    expect(allowedTransitions("PACKED", "SHIPPING")).toEqual(["SHIPPED", "PAID"]);
    expect(allowedTransitions("REFUNDED", "PICKUP")).toEqual([]);
    expect(allowedTransitions("COMPLETED", "SHIPPING")).toEqual([]);
  });
});

describe("product helpers", () => {
  it("makes URL slugs", () => expect(slugify("Whey Protein Isolate 1 kg!")).toBe("whey-protein-isolate-1-kg"));
  it("labels variants", () => {
    expect(variantLabel({ size: "M", colour: "Black", flavour: null })).toBe("M, Black");
    expect(variantLabel({ size: null, colour: null, flavour: null })).toBe("Standard");
  });
  it("flags health and performance claim words in supplement descriptions", () => {
    const words = claimWarnings("Clinically proven to burn fat and boost immunity");
    expect(words).toHaveLength(3);
    expect(words).toEqual(expect.arrayContaining(["burn fat", "clinically proven", "boost immunity"]));
    expect(claimWarnings("Chocolate whey isolate, 1 kg.")).toEqual([]);
  });
});
