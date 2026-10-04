// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CheckInPage from "@/app/admin/(console)/check-in/page";

afterEach(() => vi.unstubAllGlobals());

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
