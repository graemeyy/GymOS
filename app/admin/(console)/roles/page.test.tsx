// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import { ToastProvider } from "@/components/ui/feedback";
import { PERMISSIONS } from "@/lib/auth/permissions";
import RolesPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ALL = [...PERMISSIONS];
const ROLES = [
  { id: "role_owner", name: "Owner", description: null, preset: "OWNER", isOwner: true, permissions: ALL, staffCount: 1 },
  { id: "role_manager", name: "Manager", description: null, preset: "MANAGER", isOwner: false, permissions: ["members.view", "roles.manage"], staffCount: 2 },
  { id: "role_staff", name: "Front desk", description: null, preset: "STAFF", isOwner: false, permissions: ["members.view"], staffCount: 3 },
  { id: "role_x", name: "Weekend crew", description: null, preset: null, isOwner: false, permissions: [], staffCount: 0 },
];

function stubApi(me: { isOwner: boolean; permissions: string[] }, writes: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        writes.push(`${init.method} ${url} ${init.body ?? ""}`);
        return new Response("{}", { status: 200 });
      }
      if (url === "/api/auth/me") return new Response(JSON.stringify({ kind: "staff", id: "s1", name: "Sam", roleId: "role_manager", roleName: "Manager", ...me }));
      if (url === "/api/roles") return new Response(JSON.stringify(ROLES));
      return new Response("[]");
    })
  );
}

const renderPage = () =>
  render(
    <ToastProvider>
      <StaffSessionProvider>
        <RolesPage />
      </StaffSessionProvider>
    </ToastProvider>
  );

const box = (name: string) => screen.getAllByRole("checkbox", { name })[0] as HTMLInputElement;

describe("roles page", () => {
  it("shows the matrix read-only, with a note, to staff without roles.manage", async () => {
    stubApi({ isOwner: false, permissions: ["members.view"] }, []);
    renderPage();
    await screen.findAllByRole("checkbox", { name: "Front desk: See members" });
    expect(box("Front desk: See members").checked).toBe(true);
    expect(box("Front desk: See members").disabled).toBe(true);
    expect(screen.getByText("Only admins can change this")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New role/ })).toBeNull();
  });

  it("toggles a permission with one request, within the viewer's own permissions", async () => {
    const writes: string[] = [];
    stubApi({ isOwner: false, permissions: ["members.view", "roles.manage"] }, writes);
    renderPage();
    await screen.findAllByRole("checkbox", { name: "Weekend crew: See members" });
    // Owner never changes; a permission the viewer lacks can't be given.
    expect(box("Owner: See members").disabled).toBe(true);
    expect(box("Weekend crew: See money").disabled).toBe(true);
    fireEvent.click(box("Weekend crew: See members"));
    await waitFor(() => expect(writes).toEqual(['PUT /api/roles/role_x {"permissions":["members.view"]}']));
  });

  it("creates a custom role copied from another, keeping only permissions the viewer has", async () => {
    const writes: string[] = [];
    stubApi({ isOwner: false, permissions: ["members.view", "roles.manage"] }, writes);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /New role/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Cleaners" } });
    fireEvent.change(within(dialog).getByLabelText(/Start with the permissions of/), { target: { value: "role_manager" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    await waitFor(() => expect(writes).toEqual(['POST /api/roles {"name":"Cleaners","description":null,"permissions":["members.view","roles.manage"]}']));
  });

  it("offers delete only for custom roles", async () => {
    stubApi({ isOwner: true, permissions: ALL }, []);
    renderPage();
    await screen.findAllByRole("button", { name: "Delete Weekend crew" });
    expect(screen.queryByRole("button", { name: "Delete Manager" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rename Owner" })).toBeNull();
  });
});
