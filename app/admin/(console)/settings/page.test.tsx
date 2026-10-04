// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import SettingsPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me = { kind: "staff", id: "s1", name: "Sam", role: "OWNER", permissions: ["dashboard:view", "settings:manage", "staff:manage", "staff:read"] };

function stubApi(writes: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        writes.push(`${init.method} ${url} ${init.body ?? ""}`);
        return new Promise<Response>(() => undefined); // still being sent
      }
      if (url === "/api/auth/me") return Promise.resolve(new Response(JSON.stringify(me)));
      if (url === "/api/settings/features") return Promise.resolve(new Response(JSON.stringify({ requireKeycardForEntry: false, hideRevenueFromFrontDesk: false })));
      if (url === "/api/staff") return Promise.resolve(new Response(JSON.stringify([me, { id: "s2", name: "Jo", email: "jo@example.com", role: "FRONT_DESK" }])));
      return Promise.resolve(new Response("[]"));
    })
  );
}

const renderPage = () =>
  render(
    <StaffSessionProvider>
      <SettingsPage />
    </StaffSessionProvider>
  );

describe("settings page", () => {
  it("saves one switch at a time, sending only the changed field", async () => {
    const writes: string[] = [];
    stubApi(writes);
    renderPage();
    const keycard = await screen.findByRole("switch", { name: /Require a keycard/ });
    fireEvent.click(keycard);
    fireEvent.click(screen.getByRole("switch", { name: /Hide revenue/ }));
    await waitFor(() => expect(writes.length).toBe(1));
    expect(writes[0]).toBe('PUT /api/settings/features {"requireKeycardForEntry":true}');
  });

  it("removes a staff account once, after asking", async () => {
    const writes: string[] = [];
    stubApi(writes);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Jo" }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Remove account" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(writes).toEqual(["DELETE /api/staff/s2 "]));
  });
});
