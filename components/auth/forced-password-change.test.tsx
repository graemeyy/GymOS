// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const { ForcedPasswordChange } = await import("./forced-password-change");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
  window.history.replaceState(null, "", "/");
});

function fill(current: string, next: string, again: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("New password again"), { target: { value: again } });
  fireEvent.submit(screen.getByRole("button", { name: "Save new password" }).closest("form")!);
}

describe("required password change (D-111)", () => {
  it("doesn't send anything when the two new passwords differ", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ForcedPasswordChange kind="staff" name="Sam" onChanged={vi.fn()} />);
    fill("given-password", "new-password-1", "new-password-2");
    expect(screen.getByText("The passwords don't match")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the staff fields, then lets the app carry on", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();
    render(<ForcedPasswordChange kind="staff" name="Sam" onChanged={onChanged} />);
    fill("given-password", "new-password-1", "new-password-1");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/staff/me/password");
    expect(JSON.parse(String(init.body))).toEqual({ currentPassword: "given-password", newPassword: "new-password-1" });
  });

  it("sends the member fields and returns to where they were heading", async () => {
    window.history.replaceState(null, "", "/member?next=%2Fshop%2Fcart");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ForcedPasswordChange kind="member" name="Jo" onChanged={vi.fn()} />);
    fill("given-password", "new-password-1", "new-password-1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/shop/cart"));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/me/password");
    expect(JSON.parse(String(init.body))).toEqual({ current: "given-password", next: "new-password-1" });
  });

  it("shows the server's reason against the field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "validation_failed", message: "Choose a password that's different from your current one.", fields: { newPassword: "Same as your current password" } } }), { status: 422 })));
    render(<ForcedPasswordChange kind="staff" name="Sam" onChanged={vi.fn()} />);
    fill("given-password", "given-password", "given-password");
    await waitFor(() => expect(screen.getByText("Same as your current password")).toBeTruthy());
  });
});
