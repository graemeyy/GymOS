import { describe, it, expect } from "vitest";
import { getSession, requireRole } from "./auth";
import { createSessionToken, SESSION_COOKIE } from "./session";

async function requestWithToken(token?: string): Promise<Request> {
  return new Request("http://localhost/api/test", {
    headers: token ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : {},
  });
}

describe("getSession", () => {
  it("returns null when there is no session cookie", async () => {
    const request = await requestWithToken();
    await expect(getSession(request)).resolves.toBeNull();
  });

  it("returns the decoded session for a valid cookie", async () => {
    const token = await createSessionToken({ staffId: "staff_1", name: "Alex", role: "MANAGER" });
    const request = await requestWithToken(token);
    await expect(getSession(request)).resolves.toMatchObject({ staffId: "staff_1", name: "Alex", role: "MANAGER" });
  });
});

describe("requireRole", () => {
  it("returns a 401 when not signed in", async () => {
    const request = await requestWithToken();
    const denied = await requireRole(request, "FRONT_DESK");
    expect(denied).not.toBeNull();
    expect(denied?.status).toBe(401);
  });

  it("returns a 403 when signed in below the required role", async () => {
    const token = await createSessionToken({ staffId: "staff_1", name: "Alex", role: "FRONT_DESK" });
    const request = await requestWithToken(token);
    const denied = await requireRole(request, "MANAGER");
    expect(denied).not.toBeNull();
    expect(denied?.status).toBe(403);
  });

  it("returns null (proceed) when signed in at exactly the required role", async () => {
    const token = await createSessionToken({ staffId: "staff_1", name: "Alex", role: "MANAGER" });
    const request = await requestWithToken(token);
    const denied = await requireRole(request, "MANAGER");
    expect(denied).toBeNull();
  });

  it("returns null (proceed) when signed in above the required role", async () => {
    const token = await createSessionToken({ staffId: "staff_1", name: "Alex", role: "OWNER" });
    const request = await requestWithToken(token);
    const denied = await requireRole(request, "FRONT_DESK");
    expect(denied).toBeNull();
  });

  it("never lets FRONT_DESK through an OWNER-only gate — the pricing/staff-management boundary", async () => {
    const token = await createSessionToken({ staffId: "staff_1", name: "Alex", role: "FRONT_DESK" });
    const request = await requestWithToken(token);
    const denied = await requireRole(request, "OWNER");
    expect(denied?.status).toBe(403);
  });
});
