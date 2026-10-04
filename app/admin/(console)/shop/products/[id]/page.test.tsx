// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProductEditorPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const product = {
  id: "p1",
  name: "Gym tee",
  description: null,
  category: "APPAREL",
  imageUrl: null,
  active: true,
  claimWarnings: [],
  variants: [{ id: "v1", size: "M", colour: null, flavour: null, sku: "TEE-M", priceCents: 3500, stockQty: 4, active: true }],
};

describe("R-57 saving a product", () => {
  it("saves once however many times it's tapped", async () => {
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method && init.method !== "GET") {
          writes.push(`${init.method} ${url}`);
          return new Promise<Response>(() => undefined); // still being sent
        }
        if (url === "/api/products/p1") return Promise.resolve(new Response(JSON.stringify(product)));
        return Promise.resolve(new Response("[]"));
      })
    );
    render(<ProductEditorPage />);
    const save = await screen.findByRole("button", { name: "Save product" });
    await screen.findByDisplayValue("TEE-M");
    fireEvent.click(save);
    fireEvent.click(save);
    expect(writes).toEqual(["PUT /api/products/p1"]);
  });
});
