// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import PassPage from "./page";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const pass = (n: number, expiresAt: Date) => ({
  token: `GYM2.code-${n}`,
  expiresAt: expiresAt.toISOString(),
  refreshSeconds: 60,
  status: "ACTIVE",
  name: "Priya Raman",
  svgDataUrl: `data:image/svg+xml;base64,${btoa(`<svg>${n}</svg>`)}`,
});

describe("the member's pass (D-119)", () => {
  it("fetches a fresh code every minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let n = 0;
    const fetch = vi.fn(async () => new Response(JSON.stringify(pass(++n, new Date(Date.now() + 90_000))), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<PassPage />);
    const first = (await screen.findByRole("img", { name: /Check-in QR code/ })).getAttribute("src");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("img", { name: /Check-in QR code/ }).getAttribute("src")).not.toBe(first);
  });

  it("hides a code that has expired when it can't get a new one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (++calls === 1 ? new Response(JSON.stringify(pass(1, new Date(Date.now() + 90_000))), { status: 200 }) : Promise.reject(new TypeError("offline"))))
    );
    render(<PassPage />);
    await screen.findByRole("img", { name: /Check-in QR code/ });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(91_000);
    });
    expect(screen.queryByRole("img", { name: /Check-in QR code/ })).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("the front desk can find you by name");
  });
});
