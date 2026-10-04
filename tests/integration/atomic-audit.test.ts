// R-98: a change and its audit entry are written together or not at all.
// The audit write is made to fail; the change must not be left behind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const failAudit = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    logAction: async (...args: Parameters<typeof actual.logAction>) => {
      if (failAudit.on) throw new Error("audit write failed");
      return actual.logAction(...args);
    },
  };
});

const inventory = await import("@/app/api/inventory/route");
const inventoryItem = await import("@/app/api/inventory/[id]/route");
const { call, createStaff, makeRequest, prisma, resetDb } = await import("../helpers");

beforeEach(resetDb);
afterEach(() => {
  failAudit.on = false;
});

describe("R-98 inventory", () => {
  it("creating, adjusting, editing and deleting roll back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const body = { name: "Chalk", quantity: 5, reorderLevel: 1 };
    const created = await call(inventory.POST, await makeRequest("POST", "/x", { as: owner, body }));
    const id = created.body.id as string;

    failAudit.on = true;
    expect((await call(inventory.POST, await makeRequest("POST", "/x", { as: owner, body: { ...body, name: "Bands" } }))).status).toBe(500);
    expect((await call(inventoryItem.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { delta: -2 } }), { id })).status).toBe(500);
    expect((await call(inventoryItem.PUT, await makeRequest("PUT", "/x", { as: owner, body: { ...body, name: "Renamed" } }), { id })).status).toBe(500);
    expect((await call(inventoryItem.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id })).status).toBe(500);

    expect(await prisma.inventoryItem.findMany({ select: { name: true, quantity: true } })).toEqual([{ name: "Chalk", quantity: 5 }]);
  });
});
