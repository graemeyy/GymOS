// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), useSearchParams: () => search }));
const { ForgotPasswordForm } = await import("./forgot-password-form");
const { ResetPasswordForm } = await import("./reset-password-form");
const { VerifyEmailForm } = await import("./verify-email-form");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
  search = new URLSearchParams();
});

const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status });

describe("forgot password (D-112)", () => {
  it("says the same thing whatever the server found, and shows a preview link only when given one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ ok: true })));
    render(<ForgotPasswordForm kind="member" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("If sam@example.com has a member account"));
    expect(screen.queryByRole("link", { name: "Open the reset link" })).toBeNull();
  });

  it("shows the link on screen when the server returns one (development and previews)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ ok: true, previewLink: "http://localhost:3000/reset-password?token=abc" })));
    render(<ForgotPasswordForm kind="staff" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }).closest("form")!);
    const link = await screen.findByRole("link", { name: "Open the reset link" });
    expect(link.getAttribute("href")).toBe("http://localhost:3000/reset-password?token=abc");
    expect(screen.getByText(/never on the live site/)).toBeTruthy();
  });
});

describe("choosing a new password", () => {
  it("explains an expired link and offers a new one", async () => {
    search = new URLSearchParams({ token: "x".repeat(43) });
    vi.stubGlobal("fetch", vi.fn(async () => reply({ error: { code: "not_found", message: "This reset link has expired or was already used. Ask for a new one." } }, 404)));
    render(<ResetPasswordForm forgotHref="/forgot-password" />);
    expect(await screen.findByText(/expired or was already used/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ask for a new link" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("checks the two passwords match, then saves and goes to the right home", async () => {
    search = new URLSearchParams({ token: "x".repeat(43) });
    const fetchMock = vi.fn(async (url: string) => (String(url).includes("?token=") ? reply({ kind: "staff" }) : reply({ kind: "staff", name: "Sam" })));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm forgotHref="/admin/forgot-password" />);
    const first = await screen.findByLabelText("New password");
    fireEvent.change(first, { target: { value: "new-password-1" } });
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "new-password-2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save new password" }).closest("form")!);
    expect(screen.getByText("The passwords don't match")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "new-password-1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save new password" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });
});

describe("confirming an email (D-113)", () => {
  it("only confirms when the button is pressed, not when the page opens", async () => {
    search = new URLSearchParams({ token: "x".repeat(43) });
    const fetchMock = vi.fn(async () => reply({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<VerifyEmailForm />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm my email address" }));
    expect(await screen.findByText("Thanks. Your email address is confirmed.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
