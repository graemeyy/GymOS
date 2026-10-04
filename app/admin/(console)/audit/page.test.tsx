// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/feedback";
import AuditPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const entry = { id: "a1", staffId: null, staffName: "Owner", action: "plan.updated", targetType: "MembershipPlan", targetId: null, details: null, createdAt: "2026-10-01T00:00:00.000Z" };

describe("R-93 audit log 'Load more'", () => {
  it("tells staff when the next page fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("cursor=")
          ? new Response(JSON.stringify({ error: { code: "error", message: "The server is busy." } }), { status: 503 })
          : new Response(JSON.stringify({ items: [entry], nextCursor: "a1" }), { status: 200 })
      )
    );
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    render(
      <ToastProvider>
        <AuditPage />
      </ToastProvider>
    );
    const more = await screen.findByRole("button", { name: "Show older entries" });
    await act(async () => fireEvent.click(more));
    await waitFor(() => expect(screen.getByText("The server is busy.")).toBeTruthy());
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
