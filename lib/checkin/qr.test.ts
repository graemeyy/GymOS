import { describe, expect, it } from "vitest";
import { createPassToken, readPassToken } from "./qr";
import { createSessionToken, verifySessionToken } from "@/lib/auth/token";

describe("QR passes", () => {
  it("round-trips member and version", async () => {
    const token = await createPassToken("m1", 3);
    expect(token.startsWith("GYM1.")).toBe(true);
    expect(await readPassToken(token)).toEqual({ m: "m1", v: 3 });
  });
  it("rejects tampering and garbage", async () => {
    const token = await createPassToken("m1", 0);
    const [prefix, body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ m: "m2", v: 0 })).toString("base64url");
    expect(await readPassToken(`${prefix}.${forged}.${sig}`)).toBeNull();
    expect(await readPassToken(`${prefix}.${body}`)).toBeNull();
    expect(await readPassToken("hello")).toBeNull();
  });
  it("a pass can't be used as a session and a session can't be used as a pass", async () => {
    const pass = await createPassToken("m1", 0);
    expect(await verifySessionToken(pass.slice(5))).toBeNull();
    const session = await createSessionToken({ kind: "member", sub: "m1", name: "", ver: 0 });
    expect(await readPassToken(`GYM1.${session}`)).toBeNull();
  });
});
