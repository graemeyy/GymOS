// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
const { UnsubscribeForm } = await import("./unsubscribe-form");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  search = new URLSearchParams();
});

const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status });

describe("the unsubscribe page (D-118)", () => {
  it("asks once, then confirms what stopped and what still comes", async () => {
    search = new URLSearchParams({ token: "abc.def" });
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? reply({ changed: true }) : reply({ label: "gym news emails", email: "s••••@example.com", subscribed: true })
    );
    vi.stubGlobal("fetch", fetch);
    render(<UnsubscribeForm />);
    fireEvent.click(await screen.findByRole("button", { name: "Unsubscribe from gym news emails" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("We won't send gym news emails to s••••@example.com"));
    expect(screen.getByRole("status").textContent).toContain("Receipts, booking confirmations and password emails still come");
    expect(fetch).toHaveBeenLastCalledWith("/api/unsubscribe?token=abc.def", expect.objectContaining({ method: "POST" }));
  });

  it("says so when the member is already unsubscribed", async () => {
    search = new URLSearchParams({ token: "abc.def" });
    vi.stubGlobal("fetch", vi.fn(async () => reply({ label: "waitlist emails", email: "s••••@example.com", subscribed: false })));
    render(<UnsubscribeForm />);
    expect(await screen.findByText(/You're unsubscribed/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains a link that doesn't work and points to the account page", async () => {
    search = new URLSearchParams({ token: "forged" });
    vi.stubGlobal("fetch", vi.fn(async () => reply({ error: { code: "not_found", message: "This unsubscribe link isn't valid. You can switch emails off in your account instead." } }, 404)));
    render(<UnsubscribeForm />);
    expect(await screen.findByText(/isn't valid/)).toBeTruthy();
  });
});
