// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import SettingsPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const me: { kind: string; id: string; name: string; roleId: string; roleName: string; isOwner: boolean; permissions: string[] } = { kind: "staff", id: "s1", name: "Sam", roleId: "role_custom", roleName: "Custom", isOwner: false, permissions: ["settings.edit", "staff.manage"] };

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
  it("saves a switch once while it's being sent, sending only the changed field", async () => {
    const writes: string[] = [];
    stubApi(writes);
    renderPage();
    const keycard = await screen.findByRole("switch", { name: /Require a keycard/ });
    fireEvent.click(keycard);
    fireEvent.click(keycard);
    await waitFor(() => expect(writes.length).toBe(1));
    expect(writes[0]).toBe('PUT /api/settings/features {"requireKeycardForEntry":true}');
  });

  // PR 6: the setting stays visible but read-only without settings.edit.
  it("shows settings read-only, with a note, to staff who can't change them", async () => {
    me.permissions = [];
    try {
      stubApi([]);
      renderPage();
      const keycard = await screen.findByRole("switch", { name: /Require a keycard/ });
      expect((keycard as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText("Only admins can change this")).toBeTruthy();
      expect(screen.queryByRole("switch", { name: /Hide revenue/ })).toBeNull();
    } finally {
      me.permissions = ["settings.edit", "staff.manage"];
    }
  });

  it("links to the staff and roles pages instead of managing accounts inline", async () => {
    stubApi([]);
    renderPage();
    expect((await screen.findByRole("link", { name: "Staff" })).getAttribute("href")).toBe("/admin/staff");
    expect(screen.getByRole("link", { name: "Roles" }).getAttribute("href")).toBe("/admin/roles");
  });
});
