// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import PlansPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me = { kind: "staff", id: "s1", name: "Sam", roleId: "role_custom", roleName: "Custom", isOwner: false, permissions: ["plans.edit", "prices.edit"] };

describe("R-57 saving a plan", () => {
  it("creates the plan once however many times it's tapped", async () => {
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method && init.method !== "GET") {
          writes.push(`${init.method} ${url}`);
          return new Promise<Response>(() => undefined); // still being sent
        }
        if (url === "/api/auth/me") return Promise.resolve(new Response(JSON.stringify(me)));
        return Promise.resolve(new Response("[]"));
      })
    );
    render(
      <StaffSessionProvider>
        <PlansPage />
      </StaffSessionProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: /New plan/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Weekly" } });
    fireEvent.change(within(dialog).getByLabelText(/Price incl. GST/), { target: { value: "29.95" } });
    const create = within(dialog).getByRole("button", { name: "Create plan" });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(writes).toEqual(["POST /api/admin/plans"]);
  });
});
