// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const { SignUpForm } = await import("./sign-up-form");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sign-up form", () => {
  it("sends one request when submitted twice quickly", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<SignUpForm />);
    const button = screen.getByRole("button", { name: /Create account/ }) as HTMLButtonElement;
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
