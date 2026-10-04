import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("stores the scrypt cost with the hash, so it can be raised later (R-77)", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("still verifies hashes made before the cost was stored", async () => {
    // "salt:hash" from the previous format: Node's default scrypt cost.
    const { scryptSync } = await import("node:crypto");
    const legacy = `abcdef0123456789abcdef0123456789:${scryptSync("old password", "abcdef0123456789abcdef0123456789", 64).toString("hex")}`;
    await expect(verifyPassword("old password", legacy)).resolves.toBe(true);
    await expect(verifyPassword("wrong", legacy)).resolves.toBe(false);
  });

  it("uses the cost stored in the hash", async () => {
    const { scryptSync } = await import("node:crypto");
    const salt = "00112233445566778899aabbccddeeff";
    const stronger = `scrypt$32768$8$1$${salt}$${scryptSync("pw-123456789", salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
    await expect(verifyPassword("pw-123456789", stronger)).resolves.toBe(true);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-valid-hash")).resolves.toBe(false);
  });
});
