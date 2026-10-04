// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import AnnouncementsPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const draft = {
  id: "a1",
  title: "Holiday hours",
  body: "Closed on Monday.",
  audience: "ALL_ACTIVE",
  planId: null,
  plan: null,
  publishedAt: null,
  expiresAt: null,
  emailedAt: null,
  emailCount: 0,
  createdBy: null,
  createdAt: new Date().toISOString(),
};

function stubFetch(writes: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        writes.push(`${init.method} ${url}`);
        return new Promise<Response>(() => undefined); // still being sent
      }
      if (url === "/api/announcements") return Promise.resolve(new Response(JSON.stringify([draft])));
      return Promise.resolve(new Response("[]"));
    })
  );
}

describe("R-16, R-57 announcement actions are sent once", () => {
  it("publishes once however many times it's tapped", async () => {
    const writes: string[] = [];
    stubFetch(writes);
    render(<AnnouncementsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    expect(writes).toEqual([]);
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Publish" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(writes).toEqual(["POST /api/announcements/a1/publish"]);
  });

  it("deletes once however many times it's tapped", async () => {
    const writes: string[] = [];
    stubFetch(writes);
    render(<AnnouncementsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(writes).toEqual([]);
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(writes).toEqual(["DELETE /api/announcements/a1"]);
  });
});
