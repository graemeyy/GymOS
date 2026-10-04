import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { serviceWorkerUrl } from "./register-sw";

// Runs public/sw.js against a fake worker scope and returns its listeners.
function loadWorker(scriptUrl: string, existingCaches: string[]) {
  const listeners: Record<string, (event: { waitUntil: (p: Promise<unknown>) => void }) => void> = {};
  const deleted: string[] = [];
  const opened: string[] = [];
  const caches = {
    open: vi.fn(async (name: string) => {
      opened.push(name);
      return { addAll: async () => undefined, put: async () => undefined };
    }),
    keys: async () => [...existingCaches, ...opened],
    delete: async (name: string) => deleted.push(name),
    match: async () => undefined,
  };
  const self = {
    location: new URL(scriptUrl, "https://gym.example"),
    addEventListener: (type: string, fn: (typeof listeners)[string]) => (listeners[type] = fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  new Function("self", "caches", "fetch", readFileSync("public/sw.js", "utf8"))(self, caches, vi.fn());
  const run = async (type: string) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners[type]({ waitUntil: (p) => (pending = p) });
    await pending;
  };
  return { run, deleted, opened };
}

describe("R-58 service worker caches", () => {
  it("a new build gets its own cache and the old build's cache is deleted", async () => {
    const worker = loadWorker(serviceWorkerUrl("build-2"), ["gymos-build-1"]);
    await worker.run("install");
    await worker.run("activate");
    expect(worker.opened).toEqual(["gymos-build-2"]);
    expect(worker.deleted).toEqual(["gymos-build-1"]);
  });

  it("registers with the build ID in the script URL", () => {
    expect(serviceWorkerUrl("abc123")).toBe("/sw.js?v=abc123");
    expect(serviceWorkerUrl("")).toBe("/sw.js");
  });
});
