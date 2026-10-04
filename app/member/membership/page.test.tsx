// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/components/member/member-shell", () => ({
  useMe: () => ({ data: null, error: null, loading: false, reload: async () => undefined }),
}));
const { default: MembershipPage } = await import("./page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const options = {
  hasMembership: true,
  selfServe: true,
  plans: [],
  cancellation: { allowed: true, scheduledFor: null, preview: null, noticeDays: 30, coolingOffDays: 0, minimumTermWeeks: 0 },
  pause: { allowed: false, current: null, minDays: 7, maxDays: 90, maxPausesPerYear: 2, pausesUsed: 0, feeCents: 0 },
};

describe("R-90 membership dialogs", () => {
  it("open without the previous attempt's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") return new Response(JSON.stringify({ error: { code: "conflict", message: "Talk to the front desk." } }), { status: 409 });
        return new Response(JSON.stringify(url.includes("payments") ? [] : options), { status: 200 });
      })
    );
    render(<MembershipPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel my membership" }));
    const dialog = screen.getByRole("dialog");
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancel membership" })));
    expect(within(dialog).getByText("Talk to the front desk.")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep my membership" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel my membership" }));
    expect(within(screen.getByRole("dialog")).queryByText("Talk to the front desk.")).toBeNull();
  });
});
