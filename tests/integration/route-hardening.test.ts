// The request-handling rules every route shares (lib/http/route.ts) and the
// session cookie. PR 5 items R-79, R-80, R-82 and R-83.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as members from "@/app/api/members/route";
import * as memberById from "@/app/api/members/[id]/route";
import * as memberPass from "@/app/api/members/[id]/pass/route";
import * as iot from "@/app/api/iot/checkin/route";
import * as login from "@/app/api/auth/login/route";
import { resetEnvCacheForTests } from "@/lib/env";
import { call, createStaff, makeRequest, resetDb } from "../helpers";

beforeEach(resetDb);
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

const BASE = { host: "localhost:3000", origin: "http://localhost:3000" };

describe("R-79 request size", () => {
  it("refuses an oversized body from its declared length", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const req = await makeRequest("POST", "/api/members", { as: owner, body: { name: "A", email: "a@example.com" }, headers: { "content-length": String(10 * 1024 * 1024) } });
    expect((await call(members.POST, req)).status).toBe(413);
  });

  it("stops reading a body that grows past the limit without a declared length", async () => {
    const owner = { staff: await createStaff("OWNER") };
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new TextEncoder().encode(" ".repeat(16 * 1024)));
        if (pulled > 1000) controller.close();
      },
    });
    const cookie = (await makeRequest("GET", "/", { as: owner })).headers.get("cookie")!;
    const req = new Request("http://localhost:3000/api/members", { method: "POST", headers: { ...BASE, cookie, "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    expect((await call(members.POST, req)).status).toBe(413);
    expect(pulled).toBeLessThan(10);
  });

  it("limits what the door gateway will read", async () => {
    vi.stubEnv("IOT_GATEWAY_SECRET", "gateway-secret-for-tests-0123");
    resetEnvCacheForTests();
    const req = new Request("http://localhost:3000/api/iot/checkin", {
      method: "POST",
      headers: { ...BASE, authorization: "Bearer gateway-secret-for-tests-0123", "content-type": "application/json" },
      body: JSON.stringify({ memberId: "x".repeat(10_000) }),
    });
    expect((await call(iot.POST, req)).status).toBe(413);
  });
});

describe("R-80 JSON only", () => {
  it("doesn't accept a content type that merely mentions JSON", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const cookie = (await makeRequest("GET", "/", { as: owner })).headers.get("cookie")!;
    const req = new Request("http://localhost:3000/api/members", { method: "POST", headers: { ...BASE, cookie, "content-type": "text/plain; x=application/json" }, body: JSON.stringify({ name: "A", email: "a@example.com" }) });
    expect((await call(members.POST, req)).status).toBe(400);
  });

  it("refuses a form-encoded body on a route that takes no body", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const m = await call(members.POST, await makeRequest("POST", "/x", { as: owner, body: { name: "Pass Holder", email: "pass@example.com" } }));
    const cookie = (await makeRequest("GET", "/", { as: owner })).headers.get("cookie")!;
    const req = new Request("http://localhost:3000/x", { method: "POST", headers: { ...BASE, cookie, "content-type": "application/x-www-form-urlencoded" }, body: "a=1" });
    expect((await call(memberPass.POST, req, { id: m.body.id as string })).status).toBe(400);
  });
});

describe("R-83 authentication comes first", () => {
  it("an unauthenticated request with a bad query is told to sign in, not how to fix the query", async () => {
    const res = await call(members.GET, await makeRequest("GET", "/api/members?take=-5&status=NOPE"));
    expect(res.status).toBe(401);
  });

  it("path parameters that can't be an ID are not found", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const res = await call(memberById.GET, await makeRequest("GET", "/x", { as: owner }), { id: "../../etc/passwd" });
    expect(res.status).toBe(404);
  });
});

describe("R-82 secure session cookie", () => {
  it("is Secure on an HTTPS site even when not running in production mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    resetEnvCacheForTests();
    await createStaff("OWNER", { email: "boss@example.com", password: "right-password-123" });
    const res = await call(login.POST, await makeRequest("POST", "/x", { body: { email: "boss@example.com", password: "right-password-123" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/;\s*Secure/i);
  });
});
