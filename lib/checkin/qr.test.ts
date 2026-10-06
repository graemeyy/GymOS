import { describe, expect, it } from "vitest";
import { createPassToken, looksLikePass, PASS_VALID_SECONDS, readPassToken } from "./qr";
import { createSessionToken, signPayload, verifySessionToken } from "@/lib/auth/token";

const at = (iso: string) => new Date(iso);

describe("short-lived QR passes (R-34, D-119)", () => {
  it("round-trip member, version and when they were issued", async () => {
    const { token, issuedAt, expiresAt } = await createPassToken("m1", 3, at("2026-10-06T08:00:00.400Z"));
    expect(token.startsWith("GYM2.")).toBe(true);
    expect(issuedAt).toEqual(at("2026-10-06T08:00:00Z"));
    expect(expiresAt.getTime() - issuedAt.getTime()).toBe(PASS_VALID_SECONDS * 1000);
    expect(await readPassToken(token, at("2026-10-06T08:01:00Z"))).toEqual({ ok: true, memberId: "m1", version: 3, issuedAt });
  });

  it("expire after 90 seconds, so a screenshot stops working", async () => {
    const { token } = await createPassToken("m1", 0, at("2026-10-06T08:00:00Z"));
    expect((await readPassToken(token, at("2026-10-06T08:01:30Z"))).ok).toBe(true);
    expect(await readPassToken(token, at("2026-10-06T08:01:31Z"))).toEqual({ ok: false, reason: "expired", memberId: "m1" });
  });

  it("refuse a code from the future", async () => {
    const { token } = await createPassToken("m1", 0, at("2026-10-06T08:10:00Z"));
    expect((await readPassToken(token, at("2026-10-06T08:09:56Z"))).ok).toBe(true);
    expect(await readPassToken(token, at("2026-10-06T08:09:00Z"))).toEqual({ ok: false, reason: "invalid" });
  });

  it("reject tampering and garbage", async () => {
    const now = at("2026-10-06T08:00:00Z");
    const { token } = await createPassToken("m1", 0, now);
    const [prefix, body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ m: "m2", v: 0, t: now.getTime() / 1000 })).toString("base64url");
    const extended = Buffer.from(JSON.stringify({ m: "m1", v: 0, t: now.getTime() / 1000 + 3600 })).toString("base64url");
    for (const bad of [`${prefix}.${forged}.${sig}`, `${prefix}.${extended}.${sig}`, `${prefix}.${body}`, "GYM2.hello", "hello"]) {
      expect(await readPassToken(bad, now), bad).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("recognise the old never-expiring passes and refuse them", async () => {
    const old = `GYM1.${await signPayload("qr", { m: "m1", v: 0 })}`;
    expect(looksLikePass(old)).toBe(true);
    expect(await readPassToken(old)).toEqual({ ok: false, reason: "old" });
  });

  it("can't be used as a session, and a session can't be used as a pass", async () => {
    const { token } = await createPassToken("m1", 0);
    expect(await verifySessionToken(token.slice(5))).toBeNull();
    const session = await createSessionToken({ kind: "member", sub: "m1", name: "", ver: 0 });
    expect(await readPassToken(`GYM2.${session}`)).toEqual({ ok: false, reason: "invalid" });
  });
});
