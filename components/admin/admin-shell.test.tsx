// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let pathname = "/admin";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { AdminShell } = await import("./admin-shell");
const { StaffSessionProvider } = await import("./staff-session");

// A controllable (min-width: 1024px) media query.
let wide = false;
const listeners = new Set<() => void>();
beforeEach(() => {
  pathname = "/admin";
  wide = false;
  listeners.clear();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return wide;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ kind: "staff", id: "s1", name: "Sam", roleId: "role_trainer", roleName: "Trainer", isOwner: false, permissions: [] }), { status: 200 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("R-59 mobile menu", () => {
  it("closes when the page changes, including browser Back", () => {
    const { rerender } = render(<AdminShell>page</AdminShell>);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    pathname = "/admin/members";
    rerender(<AdminShell>page</AdminShell>);
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes and unlocks scrolling when the window grows past the breakpoint", () => {
    render(<AdminShell>page</AdminShell>);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(document.body.style.overflow).toBe("hidden");
    act(() => {
      wide = true;
      listeners.forEach((fn) => fn());
    });
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("R-89 staff session errors", () => {
  it("says the menu couldn't load instead of showing nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "error", message: "Down" } }), { status: 500 })));
    render(
      <StaffSessionProvider>
        <AdminShell>page</AdminShell>
      </StaffSessionProvider>
    );
    await waitFor(() => expect(screen.getAllByText(/Couldn't load your menu/).length).toBeGreaterThan(0));
  });
});

describe("menu by role", () => {
  const menuFor = async (permissions: string[]) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ kind: "staff", id: "s1", name: "Sam", roleId: "r", roleName: "Role", isOwner: false, permissions }), { status: 200 })));
    render(
      <StaffSessionProvider>
        <AdminShell>page</AdminShell>
      </StaffSessionProvider>
    );
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Classes" }).length).toBeGreaterThan(0));
    return (name: string) => screen.queryAllByRole("link", { name }).length > 0;
  };

  it("a trainer sees classes and roles, but not members, money, stock, equipment or staff", async () => {
    const has = await menuFor([]);
    expect(has("Roles")).toBe(true);
    for (const name of ["Members", "Payments", "Stock", "Equipment", "Staff"]) expect(has(name)).toBe(false);
  });

  it("front desk sees stock and equipment through orders", async () => {
    const has = await menuFor(["members.view", "checkin.scan", "bookings.manage", "orders.manage"]);
    for (const name of ["Members", "Check-in", "Stock", "Equipment"]) expect(has(name)).toBe(true);
    for (const name of ["Payments", "Staff"]) expect(has(name)).toBe(false);
  });
});

describe("required password change (D-111)", () => {
  it("shows only the change-password screen until it's done", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ kind: "staff", id: "s1", name: "Sam", roleId: "r", roleName: "Owner", isOwner: true, permissions: [], mustChangePassword: true }), { status: 200 })));
    render(
      <StaffSessionProvider>
        <AdminShell>console page</AdminShell>
      </StaffSessionProvider>
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeTruthy());
    expect(screen.queryByText("console page")).toBeNull();
    expect(screen.queryByRole("link", { name: "Classes" })).toBeNull();
  });
});
