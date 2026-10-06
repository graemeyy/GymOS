// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CheckInPage from "@/app/admin/(console)/check-in/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("R-15 check-in after a failed scan", () => {
  it("selects the failed code so the next scan replaces it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? new Response(JSON.stringify({ error: { code: "not_found", message: "That pass isn't valid." } }), { status: 404 })
          : new Response("[]", { status: 200 })
      )
    );
    render(<CheckInPage />);
    const input = screen.getByLabelText("Pass, member ID or email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "GYM1.bad" } });
    await act(async () => fireEvent.submit(input.closest("form")!));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("isn't valid"));
    expect(input.value).toBe("GYM1.bad");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("GYM1.bad".length);
  });
});

describe("finding a member when the pass won't scan (D-119)", () => {
  it("searches by name and checks the chosen member in by ID", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ granted: true, reason: null, warning: null, method: "MANUAL", member: { id: "m1", name: "Priya Raman", status: "ACTIVE", plan: "Unlimited", retentionScore: 80, keycardIssued: true } }), { status: 200 });
      }
      if (url.startsWith("/api/check-in/search")) {
        return new Response(JSON.stringify([{ id: "m1", name: "Priya Raman", status: "ACTIVE", archivedAt: null, membershipPlan: { name: "Unlimited" } }]), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    render(<CheckInPage />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "priya" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Find" })));
    expect(fetch).toHaveBeenCalledWith("/api/check-in/search?q=priya", expect.anything());
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Check in Priya Raman" })));
    await waitFor(() => expect(screen.getByText("Come on in")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith("/api/check-in", expect.objectContaining({ method: "POST", body: JSON.stringify({ query: "m1" }) }));
  });
});
