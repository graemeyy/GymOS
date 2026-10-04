// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useResource } from "./api";

afterEach(() => vi.unstubAllGlobals());

function deferredFetch() {
  const pending: { url: string; resolve: (body: unknown) => void }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          pending.push({ url, resolve: (body) => resolve(new Response(JSON.stringify(body), { status: 200 })) });
        })
    )
  );
  return pending;
}

describe("R-52 useResource", () => {
  it("ignores an older response to the same URL that arrives after a newer one", async () => {
    const pending = deferredFetch();
    const { result } = renderHook(() => useResource<{ n: number }>("/api/x"));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => void result.current.reload());
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1].resolve({ n: 2 }));
    await act(async () => pending[0].resolve({ n: 1 }));
    expect(result.current.data).toEqual({ n: 2 });
  });

  it("doesn't show the previous URL's data while a new URL loads", async () => {
    const pending = deferredFetch();
    const { result, rerender } = renderHook(({ url }) => useResource<{ week: number }>(url), { initialProps: { url: "/api/week?w=0" } });
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => pending[0].resolve({ week: 0 }));
    expect(result.current.data).toEqual({ week: 0 });
    rerender({ url: "/api/week?w=1" });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
