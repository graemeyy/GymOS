// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import ClassesPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me = { kind: "staff", id: "s1", name: "Sam", role: "OWNER", permissions: ["classes:read", "classes:attendance", "classes:manage"] };
const cls = {
  id: "c1",
  name: "Yoga",
  instructor: null,
  trainer: null,
  startTime: new Date(Date.now() + 3_600_000).toISOString(),
  durationMinutes: 60,
  capacity: 10,
  bookings: [{ id: "b1", memberId: "m1", status: "BOOKED", member: { id: "m1", name: "Alex", email: "alex@example.com" } }],
  waitlist: [],
};

describe("R-57 double taps on class actions", () => {
  it("marks attendance once however many times it's tapped", async () => {
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method && init.method !== "GET") {
          writes.push(`${init.method} ${url}`);
          return new Promise<Response>(() => undefined); // still being sent
        }
        if (url === "/api/auth/me") return Promise.resolve(new Response(JSON.stringify(me)));
        if (url.startsWith("/api/classes")) return Promise.resolve(new Response(JSON.stringify([cls])));
        return Promise.resolve(new Response("[]"));
      })
    );
    render(
      <StaffSessionProvider>
        <ClassesPage />
      </StaffSessionProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "Show roster for Yoga" }));
    const attended = screen.getByRole("button", { name: "Attended" });
    fireEvent.click(attended);
    fireEvent.click(attended);
    fireEvent.click(screen.getByRole("button", { name: "No-show" }));
    await waitFor(() => expect(writes.length).toBeGreaterThan(0));
    expect(writes).toEqual(["PATCH /api/classes/c1/book"]);
  });
});
