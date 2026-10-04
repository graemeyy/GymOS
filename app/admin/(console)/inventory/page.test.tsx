// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import StockPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me = { kind: "staff", id: "s1", name: "Sam", roleId: "role_custom", roleName: "Custom", isOwner: false, permissions: ["products.edit", "orders.manage"] };
const item = { id: "i1", name: "Chalk", category: null, sku: null, quantity: 5, reorderLevel: 2, unitCostCents: null };

describe("R-57 removing a stock item", () => {
  it("asks first, then sends the removal once", async () => {
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method && init.method !== "GET") {
          writes.push(`${init.method} ${url}`);
          return new Promise<Response>(() => undefined); // still being sent
        }
        if (url === "/api/auth/me") return Promise.resolve(new Response(JSON.stringify(me)));
        if (url === "/api/inventory") return Promise.resolve(new Response(JSON.stringify([item])));
        return Promise.resolve(new Response("[]"));
      })
    );
    render(
      <StaffSessionProvider>
        <StockPage />
      </StaffSessionProvider>
    );
    fireEvent.click((await screen.findAllByRole("button", { name: "Remove Chalk" }))[0]);
    expect(writes).toEqual([]);
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Remove item" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(writes).toEqual(["DELETE /api/inventory/i1"]);
  });
});
