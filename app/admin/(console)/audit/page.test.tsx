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
        url === "/api/staff/directory"
          ? new Response(JSON.stringify([]), { status: 200 })
          : url.includes("cursor=")
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

describe("old and new values", () => {
  it("lists what an entry changed and filters by who made the change", async () => {
    const changed = { ...entry, id: "a2", action: "plan.price_changed", before: { name: "Gold", priceCents: 5000 }, after: { name: "Gold", priceCents: 5500 } };
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/staff/directory"
        ? new Response(JSON.stringify([{ id: "s9", name: "Priya", roleName: "Admin" }]), { status: 200 })
        : new Response(JSON.stringify({ items: [changed], nextCursor: null }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ToastProvider>
        <AuditPage />
      </ToastProvider>
    );
    const summary = (await screen.findAllByText("1 change"))[0];
    await act(async () => fireEvent.click(summary));
    expect(screen.getAllByText("priceCents").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5500").length).toBeGreaterThan(0);
    expect(screen.queryByText("name")).toBeNull();

    const who = await screen.findByRole("combobox", { name: "Who" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Priya" })).toBeTruthy());
    await act(async () => fireEvent.change(who, { target: { value: "s9" } }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes("staffId=s9"))).toBe(true));
  });
});
