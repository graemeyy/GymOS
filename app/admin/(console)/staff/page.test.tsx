// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StaffSessionProvider } from "@/components/admin/staff-session";
import { ToastProvider } from "@/components/ui/feedback";
import { PERMISSIONS } from "@/lib/auth/permissions";
import StaffPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ALL = [...PERMISSIONS];
const ROLES = [
  { id: "role_owner", name: "Owner", isOwner: true, permissions: ALL },
  { id: "role_admin", name: "Admin", isOwner: false, permissions: ALL },
  { id: "role_manager", name: "Manager", isOwner: false, permissions: ["members.view", "finance.view", "staff.manage"] },
  { id: "role_staff", name: "Front desk", isOwner: false, permissions: ["members.view", "checkin.scan"] },
];
const STAFF = [
  { id: "s1", name: "Sam", email: "sam@example.com", role: { id: "role_manager", name: "Manager", isOwner: false }, status: "active", inviteExpiresAt: null },
  { id: "s2", name: "Jo", email: "jo@example.com", role: { id: "role_staff", name: "Front desk", isOwner: false }, status: "active", inviteExpiresAt: null },
  { id: "s3", name: "Mel", email: "mel@example.com", role: { id: "role_owner", name: "Owner", isOwner: true }, status: "active", inviteExpiresAt: null },
  { id: "s4", name: "Kai", email: "kai@example.com", role: { id: "role_staff", name: "Front desk", isOwner: false }, status: "invited", inviteExpiresAt: "2026-10-11T00:00:00.000Z" },
];

function stubApi(me: { isOwner: boolean; permissions: string[] }, writes: string[], respond: (url: string) => unknown = () => ({})) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        writes.push(`${init.method} ${url} ${init.body ?? ""}`);
        return new Response(JSON.stringify(respond(url)), { status: 200 });
      }
      if (url === "/api/auth/me") return new Response(JSON.stringify({ kind: "staff", id: "s1", name: "Sam", roleId: "role_manager", roleName: "Manager", ...me }));
      if (url === "/api/staff") return new Response(JSON.stringify(STAFF));
      if (url === "/api/roles") return new Response(JSON.stringify(ROLES));
      return new Response("[]");
    })
  );
}

const renderPage = () =>
  render(
    <ToastProvider>
      <StaffSessionProvider>
        <StaffPage />
      </StaffSessionProvider>
    </ToastProvider>
  );

describe("staff page", () => {
  it("offers only roles within the viewer's own permissions, and never changes owners or yourself", async () => {
    stubApi({ isOwner: false, permissions: ["members.view", "finance.view", "staff.manage", "checkin.scan"] }, []);
    renderPage();
    const joRole = (await screen.findAllByLabelText("Role for Jo"))[0];
    expect(within(joRole).getAllByRole("option").map((o) => o.textContent)).toEqual(["Manager", "Front desk"]);
    expect(screen.queryByLabelText("Role for Sam")).toBeNull();
    expect(screen.queryByLabelText("Role for Mel")).toBeNull();
    // Jo and Kai, once each in the table and the phone list.
    expect(screen.getAllByRole("button", { name: "Deactivate" })).toHaveLength(4);
  });

  it("an owner can give the Owner role", async () => {
    stubApi({ isOwner: true, permissions: ALL }, []);
    renderPage();
    const joRole = (await screen.findAllByLabelText("Role for Jo"))[0];
    await waitFor(() => expect(within(joRole).getAllByRole("option").map((o) => o.textContent)).toEqual(["Owner", "Admin", "Manager", "Front desk"]));
  });

  it("changes a role with one request", async () => {
    const writes: string[] = [];
    stubApi({ isOwner: true, permissions: ALL }, writes, () => ({ ...STAFF[1], role: { id: "role_manager", name: "Manager", isOwner: false } }));
    renderPage();
    const joRole = (await screen.findAllByLabelText("Role for Jo"))[0];
    await waitFor(() => expect(within(joRole).getAllByRole("option")).toHaveLength(4));
    fireEvent.change(joRole, { target: { value: "role_manager" } });
    await waitFor(() => expect(writes).toEqual(['PUT /api/staff/s2 {"roleId":"role_manager"}']));
  });

  it("deactivates an account once, after asking", async () => {
    const writes: string[] = [];
    stubApi({ isOwner: true, permissions: ALL }, writes, () => ({ ...STAFF[1], status: "deactivated" }));
    renderPage();
    await screen.findAllByText("Jo");
    fireEvent.click(screen.getAllByRole("button", { name: "Deactivate" })[0]);
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate account" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(writes).toEqual(['PUT /api/staff/s2 {"active":false}']));
  });

  it("invites by email, and shows the link to pass on when email isn't set up", async () => {
    const writes: string[] = [];
    stubApi({ isOwner: true, permissions: ALL }, writes, () => ({ staff: { ...STAFF[3], name: "Ari", email: "ari@example.com" }, emailed: false, inviteUrl: "http://localhost:3000/admin/invite?token=abc" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Invite staff/ }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBe(4));
    fireEvent.change(within(dialog).getByLabelText("Full name"), { target: { value: "Ari" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "ari@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(writes).toEqual(['POST /api/staff/invite {"name":"Ari","email":"ari@example.com","roleId":"role_staff"}']));
    expect(((await screen.findByLabelText("Invitation link")) as HTMLInputElement).value).toBe("http://localhost:3000/admin/invite?token=abc");
  });

  it("resends an invitation that hasn't been accepted", async () => {
    const writes: string[] = [];
    stubApi({ isOwner: true, permissions: ALL }, writes, () => ({ staff: STAFF[3], emailed: true, inviteUrl: null }));
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: /Resend invite/ }))[0]);
    await waitFor(() => expect(writes).toEqual(["POST /api/staff/s4/invite "]));
  });
});
