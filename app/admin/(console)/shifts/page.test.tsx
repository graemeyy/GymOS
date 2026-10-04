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

describe("R-109 overnight shifts", () => {
  it("finish at the chosen time the next day when daylight saving starts overnight", async () => {
    let posted: { startTime: string; endTime: string } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posted = JSON.parse(String(init.body));
          return new Response("{}", { status: 201 });
        }
        if (url === "/api/auth/me") return new Response(JSON.stringify(me));
        if (url === "/api/staff") return new Response(JSON.stringify([{ id: "s2", name: "Jo" }]));
        return new Response("[]");
      })
    );
    render(
      <StaffSessionProvider>
        <ShiftsPage />
      </StaffSessionProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: /Add shift/ }));
    const dialog = screen.getByRole("dialog");
    await screen.findByRole("option", { name: "Jo" });
    fireEvent.change(within(dialog).getByLabelText(/Staff member/), { target: { value: "s2" } });
    fireEvent.change(within(dialog).getByLabelText(/Date/), { target: { value: "2026-10-03" } });
    fireEvent.change(within(dialog).getByLabelText("Start"), { target: { value: "22:00" } });
    fireEvent.change(within(dialog).getByLabelText(/Finish/), { target: { value: "06:00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add shift" }));
    await vi.waitFor(() => expect(posted).not.toBeNull());
    // Sydney clocks go forward at 2am on 4 October: 6am is AEDT (UTC+11).
    expect(posted!.startTime).toBe("2026-10-03T12:00:00.000Z");
    expect(posted!.endTime).toBe("2026-10-03T19:00:00.000Z");
  });
});
