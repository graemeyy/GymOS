// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/member/member-shell", () => ({
  useMe: () => ({
    data: { name: "Sam Lee", email: "sam@example.com", notifyAnnouncements: true, notifyWaitlist: true },
    error: null,
    loading: false,
    reload: async () => undefined,
  }),
}));
const { default: AccountPage } = await import("./page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// GETs answer straight away; changes never finish, so they stay in flight.
function stubFetch() {
  const isChange = (init?: RequestInit) => Boolean(init?.method && init.method !== "GET");
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    isChange(init) ? new Promise<Response>(() => {}) : Promise.resolve(new Response(JSON.stringify({ blockers: [] }), { status: 200 }))
  );
  vi.stubGlobal("fetch", fetchMock);
  return () => fetchMock.mock.calls.filter(([, init]) => isChange(init)).map(([url]) => url);
}

describe("account page", () => {
  it("saves the name once when submitted twice quickly", async () => {
    const changes = stubFetch();
    render(<AccountPage />);
    const button = screen.getByRole("button", { name: /Save name/ }) as HTMLButtonElement;
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(changes()).toEqual(["/api/me"]);
  });

  it("changes the password once when submitted twice quickly", async () => {
    const changes = stubFetch();
    render(<AccountPage />);
    const button = screen.getByRole("button", { name: /Change password/ }) as HTMLButtonElement;
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(changes()).toEqual(["/api/me/password"]);
  });
});
