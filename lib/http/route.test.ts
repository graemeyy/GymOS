import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "./route";
import { ApiError } from "./errors";

function req(method: string, headers: Record<string, string>) {
  return new Request("http://localhost:3000/api/x", { method, headers: { host: "localhost:3000", ...headers } });
}

describe("assertSameOrigin", () => {
  it("allows same-origin mutations and any GET", () => {
    expect(() => assertSameOrigin(req("POST", { origin: "http://localhost:3000" }))).not.toThrow();
    expect(() => assertSameOrigin(req("GET", { origin: "https://evil.example" }))).not.toThrow();
  });

  it("blocks cross-site mutations", () => {
    expect(() => assertSameOrigin(req("POST", { origin: "https://evil.example" }))).toThrow(ApiError);
    expect(() => assertSameOrigin(req("DELETE", { "sec-fetch-site": "cross-site" }))).toThrow(ApiError);
    expect(() => assertSameOrigin(req("PUT", { origin: "null" }))).toThrow(ApiError);
  });
});
