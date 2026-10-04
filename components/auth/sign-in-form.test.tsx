// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const { SignInForm } = await import("./sign-in-form");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sign-in form", () => {
  it("sends one request when submitted twice quickly", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<SignInForm endpoint="/api/auth/member-login" home="/member" prefix="/member" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
    const button = screen.getByRole("button", { name: /Sign in/ }) as HTMLButtonElement;
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
