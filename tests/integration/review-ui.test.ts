// Regression tests for the server side of the UI items in docs/REVIEW.md.
// Each test is named after its review ID and failed before the fix.
import { beforeEach, describe, expect, it } from "vitest";
import * as features from "@/app/api/settings/features/route";
import * as auditLog from "@/app/api/audit-log/route";
import * as announcements from "@/app/api/announcements/route";
import { call, createStaff, makeRequest, prisma, resetDb } from "../helpers";

beforeEach(resetDb);

describe("R-51 front-desk switches", () => {
  it("saving one switch leaves the other as it is", async () => {
    const owner = { staff: await createStaff("OWNER") };
    await prisma.gymSettings.create({ data: { id: "singleton", requireKeycardForEntry: true, hideRevenueFromFrontDesk: false } });
    // Two quick toggles: each sends only its own field.
    expect((await call(features.PUT, await makeRequest("PUT", "/x", { as: owner, body: { hideRevenueFromFrontDesk: true } }))).status).toBe(200);
    const after = await prisma.gymSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(after).toMatchObject({ requireKeycardForEntry: true, hideRevenueFromFrontDesk: true });
  });

  it("refuses an empty change", async () => {
    const owner = { staff: await createStaff("OWNER") };
    expect((await call(features.PUT, await makeRequest("PUT", "/x", { as: owner, body: {} }))).status).toBe(422);
  });
});

describe("R-108 plain dates are gym-local days", () => {
  it("the audit log's date filter covers the whole day at the gym", async () => {
    const owner = { staff: await createStaff("OWNER") };
    // Sydney is UTC+10 on 3 October 2026.
    const at = (iso: string, action: string) => prisma.auditLog.create({ data: { staffName: "Owner", action, targetType: "Test", createdAt: new Date(iso) } });
    await at("2026-10-02T13:00:00Z", "test.before"); // 2 Oct, 11pm
    await at("2026-10-02T15:00:00Z", "test.early"); // 3 Oct, 1am
    await at("2026-10-03T05:00:00Z", "test.afternoon"); // 3 Oct, 3pm
    await at("2026-10-03T15:00:00Z", "test.after"); // 4 Oct, 1am
    const res = await call(auditLog.GET, await makeRequest("GET", "/x?from=2026-10-03&to=2026-10-03&action=test.", { as: owner }));
    expect(res.status).toBe(200);
    const actions = (res.body.items as unknown as { action: string }[]).map((r) => r.action).sort();
    expect(actions).toEqual(["test.afternoon", "test.early"]);
  });

  it("an announcement shown until a date stays up for all of that day at the gym", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const res = await call(announcements.POST, await makeRequest("POST", "/x", { as: owner, body: { title: "Closed Monday", body: "Public holiday hours.", expiresAt: "2026-10-03" } }));
    expect(res.status).toBe(201);
    const saved = await prisma.announcement.findUniqueOrThrow({ where: { id: res.body.id as string } });
    expect(saved.expiresAt?.toISOString()).toBe("2026-10-03T14:00:00.000Z");
  });
});
