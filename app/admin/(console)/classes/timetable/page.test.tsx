// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import TimetablePage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me = { kind: "staff", id: "s1", name: "Sam", roleId: "role_custom", roleName: "Custom", isOwner: false, permissions: ["classes.manage"] };
const slot = { id: "t1", name: "Yoga", weekday: 0, startTime: "06:00", durationMinutes: 45, capacity: 16, active: true, trainer: null };

describe("R-57 removing a timetable slot", () => {
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
        if (url === "/api/class-templates") return Promise.resolve(new Response(JSON.stringify([slot])));
        return Promise.resolve(new Response("[]"));
      })
    );
    render(
      <StaffSessionProvider>
        <TimetablePage />
      </StaffSessionProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "Remove Monday Yoga" }));
    expect(writes).toEqual([]);
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Remove slot" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(writes).toEqual(["DELETE /api/class-templates/t1"]);
  });
});
