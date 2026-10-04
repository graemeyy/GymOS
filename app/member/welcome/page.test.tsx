// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/member/member-shell", () => ({
  useMe: () => ({ data: null, error: null, loading: false, reload: async () => undefined }),
}));
const { default: WelcomePage } = await import("./page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("welcome page", () => {
  it("records pay at the desk once when clicked twice quickly", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === "POST" ? new Promise<Response>(() => {}) : Promise.resolve(new Response("[]", { status: 200 }))
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<WelcomePage />);
    const button = (await screen.findByRole("button", { name: /pay at the front desk/ })) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").map(([url]) => url)).toEqual(["/api/me/onboarding"]);
  });
});
