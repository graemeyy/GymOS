import { describe, expect, it, vi } from "vitest";
import { createSessionToken, signPayload, timingSafeEqualStrings, verifyPayload, verifySessionToken } from "./token";

describe("session tokens", () => {
  it("round-trips staff and member sessions", async () => {
    const staff = await verifySessionToken(await createSessionToken({ kind: "staff", sub: "s1", name: "Mel", role: "OWNER", ver: 3 }));
    expect(staff).toMatchObject({ kind: "staff", sub: "s1", role: "OWNER", ver: 3 });
    const member = await verifySessionToken(await createSessionToken({ kind: "member", sub: "m1", name: "Jack", ver: 0 }));
    expect(member).toMatchObject({ kind: "member", sub: "m1" });
    expect(member && "role" in member).toBe(false);
  });

  it("rejects a tampered payload (member upgrading to owner)", async () => {
    const token = await createSessionToken({ kind: "member", sub: "m1", name: "Jack", ver: 0 });
    const [body, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    const evil = Buffer.from(JSON.stringify({ ...forged, kind: "staff", role: "OWNER" })).toString("base64url");
    expect(await verifySessionToken(`${evil}.${sig}`)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await createSessionToken({ kind: "staff", sub: "s1", name: "Mel", role: "OWNER", ver: 0 }, 60);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    try {
      expect(await verifySessionToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a token signed for one purpose can't be used for another", async () => {
    const qr = await signPayload("qr", { kind: "staff", sub: "s1", role: "OWNER", ver: 0, exp: 9_999_999_999 });
    expect(await verifySessionToken(qr)).toBeNull();
    expect(await verifyPayload("qr", qr)).not.toBeNull();
  });

  it("rejects garbage", async () => {
    for (const t of [undefined, null, "", "abc", "a.b.c", "....."]) expect(await verifySessionToken(t)).toBeNull();
  });
});

describe("timingSafeEqualStrings", () => {
  it("compares exactly", () => {
    expect(timingSafeEqualStrings("Bearer abc", "Bearer abc")).toBe(true);
    expect(timingSafeEqualStrings("Bearer abc", "Bearer abd")).toBe(false);
    expect(timingSafeEqualStrings("Bearer abc", "Bearer abcd")).toBe(false);
    expect(timingSafeEqualStrings("", "Bearer undefined")).toBe(false);
  });
});
