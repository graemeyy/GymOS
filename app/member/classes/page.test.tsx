// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/member/member-shell", () => ({
  useMe: () => ({ data: null, error: null, loading: false, reload: async () => undefined }),
}));
const { default: MemberClassesPage } = await import("./page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const soon = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const row = (id: string, name: string, hours: number) => ({
  id,
  name,
  startTime: soon(hours),
  durationMinutes: 60,
  coach: null,
  capacity: 10,
  spotsLeft: 5,
  waitlistLength: 0,
  booked: false,
  waitlistPosition: null,
  bookingOpen: true,
});

describe("R-61 booking two classes quickly", () => {
  it("keeps the first button busy until its own booking finishes", async () => {
    const timetable = { bookingOpensDaysAhead: 7, cancelWithoutPenaltyHours: 2, lateCancelForfeitsCredit: true, classes: [row("c1", "Yoga", 2), row("c2", "Boxing", 3)] };
    const pending = new Map<string, (r: Response) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "POST") return new Promise<Response>((resolve) => pending.set(url, resolve));
        return Promise.resolve(new Response(JSON.stringify(timetable), { status: 200 }));
      })
    );
    render(<MemberClassesPage />);
    const yoga = (await screen.findByRole("button", { name: /^Book Yoga/ })) as HTMLButtonElement;
    const boxing = screen.getByRole("button", { name: /^Book Boxing/ }) as HTMLButtonElement;
    fireEvent.click(yoga);
    fireEvent.click(boxing);
    await waitFor(() => expect(pending.size).toBe(2));
    // Boxing finishes first; Yoga is still being sent.
    await act(async () => pending.get("/api/me/classes/c2/booking")!(new Response("{}", { status: 201 })));
    await waitFor(() => expect(boxing.disabled).toBe(false));
    expect(yoga.disabled).toBe(true);
  });
});
