// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => search,
}));
const { SignInForm } = await import("./sign-in-form");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
  search = new URLSearchParams();
});

async function signIn(response: object) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(response), { status: 200 })));
  render(<SignInForm endpoint="/api/auth/member-login" home="/member" prefix="/" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
  fireEvent.submit(screen.getByRole("button", { name: /Sign in/ }).closest("form")!);
  await waitFor(() => expect(push).toHaveBeenCalled());
  return push.mock.calls[0][0];
}

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

  it("goes where the person was heading", async () => {
    search = new URLSearchParams({ next: "/shop/cart" });
    expect(await signIn({ kind: "member", mustChangePassword: false })).toBe("/shop/cart");
  });

  // D-111: the app shows "Choose a new password" first, then carries on.
  it("sends someone who must change their password home first, keeping where they were heading", async () => {
    search = new URLSearchParams({ next: "/shop/cart" });
    expect(await signIn({ kind: "member", mustChangePassword: true })).toBe("/member?next=%2Fshop%2Fcart");
  });
});
