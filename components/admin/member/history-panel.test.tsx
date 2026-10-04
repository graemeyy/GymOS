// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { HistoryPanel } from "./history-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("R-55 membership history after a change", () => {
  it("reloads when the membership version goes up", async () => {
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<HistoryPanel memberId="m1" version={0} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => rerender(<HistoryPanel memberId="m1" version={1} />));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
