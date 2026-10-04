// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiClientError, useMutation, useResource } from "./api";

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

describe("useMutation", () => {
  it("sends one request at a time, however often it's called", async () => {
    let finish: (v: string) => void = () => undefined;
    const fn = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useMutation(fn));
    let first: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      first = result.current.run();
      void result.current.run();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    await act(async () => finish("done"));
    expect(await first).toBe("done");
    expect(result.current.busy).toBe(false);
  });

  it("turns an API error into a message and field errors, and reports it", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useMutation(async () => Promise.reject(new ApiClientError(422, "validation_failed", "Some fields need attention.", { email: "Required" })), { onError }));
    await act(async () => expect(await result.current.run()).toBeUndefined());
    expect(result.current.error).toBe("Some fields need attention.");
    expect(result.current.fields).toEqual({ email: "Required" });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 422 }));
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it("runs onSuccess with the result before finishing", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useMutation(async (n: number) => n * 2, { onSuccess }));
    await act(async () => void (await result.current.run(21)));
    expect(onSuccess).toHaveBeenCalledWith(42, 21);
  });
});
