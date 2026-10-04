// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import ShiftsPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me = { kind: "staff", id: "s1", name: "Sam", role: "OWNER", permissions: ["shifts:read", "shifts:manage"] };
const shift = { id: "sh1", startTime: new Date(Date.now() + 3_600_000).toISOString(), endTime: new Date(Date.now() + 9 * 3_600_000).toISOString(), notes: null, staff: { id: "s2", name: "Jo", role: "FRONT_DESK" } };

describe("R-57 removing a shift", () => {
  it("asks first, then sends the removal once", async () => {
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          writes.push(url);
          return new Promise<Response>(() => undefined);
        }
        if (url === "/api/auth/me") return Promise.resolve(new Response(JSON.stringify(me)));
        if (url === "/api/shifts") return Promise.resolve(new Response(JSON.stringify([shift])));
        return Promise.resolve(new Response("[]"));
      })
    );
    render(
      <StaffSessionProvider>
        <ShiftsPage />
      </StaffSessionProvider>
    );
    fireEvent.click((await screen.findAllByRole("button", { name: "Remove Jo's shift" }))[0]);
    expect(writes).toEqual([]);
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Remove shift" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(writes).toEqual(["/api/shifts/sh1"]);
  });
});
