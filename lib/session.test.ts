import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips staffId, name, and role", async () => {
    const token = await createSessionToken({ staffId: "staff_1", name: "Jordan", role: "MANAGER" });
    const payload = await verifySessionToken(token);
    expect(payload).toMatchObject({ staffId: "staff_1", name: "Jordan", role: "MANAGER" });
  });

  it("returns null for a missing token", async () => {
    await expect(verifySessionToken(undefined)).resolves.toBeNull();
    await expect(verifySessionToken(null)).resolves.toBeNull();
    await expect(verifySessionToken("")).resolves.toBeNull();
  });

  it("returns null for a malformed token", async () => {
    await expect(verifySessionToken("not-a-real-token")).resolves.toBeNull();
    await expect(verifySessionToken("only.two.parts.too.many")).resolves.toBeNull();
  });

  it("rejects a token whose payload has been tampered with", async () => {
    const token = await createSessionToken({ staffId: "staff_1", name: "Jordan", role: "FRONT_DESK" });
    const [payloadB64, sigB64] = token.split(".");

    // Flip the role by re-encoding a modified payload, but keep the
    // original (now-mismatched) signature — this must fail verification.
    const decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    const forgedPayload = Buffer.from(JSON.stringify({ ...decoded, role: "OWNER" })).toString("base64url");
    const forgedToken = `${forgedPayload}.${sigB64}`;

    await expect(verifySessionToken(forgedToken)).resolves.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const originalSecret = process.env.SESSION_SECRET;
    const token = await createSessionToken({ staffId: "staff_1", name: "Jordan", role: "OWNER" });

    process.env.SESSION_SECRET = "a-completely-different-secret";
    try {
      await expect(verifySessionToken(token)).resolves.toBeNull();
    } finally {
      process.env.SESSION_SECRET = originalSecret;
    }
  });
});
