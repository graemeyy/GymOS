// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import OrderDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "o1" }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me = { kind: "staff", id: "s1", name: "Sam", roleId: "role_custom", roleName: "Custom", isOwner: false, permissions: ["orders.manage"] };
const order = {
  id: "o1",
  number: 1001,
  status: "PAID",
  fulfilment: "PICKUP",
  customerName: "Alex",
  email: "alex@example.com",
  subtotalCents: 3500,
  discountCents: 0,
  discountPercent: 0,
  shippingCents: 0,
  totalCents: 3500,
  gstCents: 318,
  trackingNumber: null,
  shippingAddress: null,
  createdAt: new Date().toISOString(),
  member: null,
  payment: null,
  items: [],
  events: [],
  nextStatuses: ["PACKED", "CANCELLED"],
};

describe("R-57 changing an order's status", () => {
  it("sends the change once however many times it's tapped", async () => {
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method && init.method !== "GET") {
          writes.push(`${init.method} ${url} ${String(init.body)}`);
          return new Promise<Response>(() => undefined); // still being sent
        }
        if (url === "/api/auth/me") return Promise.resolve(new Response(JSON.stringify(me)));
        if (url === "/api/orders/o1") return Promise.resolve(new Response(JSON.stringify(order)));
        return Promise.resolve(new Response("[]"));
      })
    );
    render(
      <StaffSessionProvider>
        <OrderDetailPage />
      </StaffSessionProvider>
    );
    const packed = await screen.findByRole("button", { name: "Mark packed" });
    fireEvent.click(packed);
    fireEvent.click(packed);
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(writes).toEqual(['PATCH /api/orders/o1 {"status":"PACKED"}']);
  });
});
