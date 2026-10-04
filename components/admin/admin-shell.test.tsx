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
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ kind: "staff", id: "s1", name: "Sam", role: "OWNER", permissions: ["dashboard:view"] }), { status: 200 })));
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
