import { readdirSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { checkDatabase } from "@/lib/setup/checks";
import { createMember, createStaff, prisma, resetDb } from "../helpers";

const migrations = readdirSync("prisma/migrations").filter((n) => /^\d{14}_/.test(n)).sort();
const find = (findings: { area: string; level: string; message: string }[], area: string) => findings.filter((f) => f.area === area);

beforeEach(resetDb);

describe("setup check: the database (D-132)", () => {
  it("reports a fresh copy's state: migrations applied, no owner yet, branding unsaved, main location unnamed", async () => {
    const { findings, hasOwner } = await checkDatabase(prisma, migrations);
    expect(hasOwner).toBe(false);
    expect(find(findings, "Database").map((f) => f.level)).toEqual(["ok"]);
    expect(find(findings, "Branding")[0].level).toBe("warn");
    expect(find(findings, "Locations")[0].level).toBe("warn");
    expect(find(findings, "Plans")[0].level).toBe("ok");
  });

  it("notices demo accounts, a migration that hasn't run, and no plans", async () => {
    await createStaff("OWNER", { email: "owner@example.com" });
    await createMember({ email: "demo@example.com" });
    await prisma.membershipPlan.updateMany({ data: { active: false } });
    const { findings, hasOwner } = await checkDatabase(prisma, [...migrations, "20991231000000_not_yet"]);
    expect(hasOwner).toBe(true);
    const database = find(findings, "Database").map((f) => f.message);
    expect(database.some((m) => /1 migration\(s\) not applied yet, the newest 20991231000000_not_yet/.test(m))).toBe(true);
    expect(database.some((m) => /Demo accounts are in this database \(1 staff, 1 members/.test(m))).toBe(true);
    expect(find(findings, "Plans")[0].level).toBe("fail");
  });

  it("is happy with a set-up copy", async () => {
    await createStaff("OWNER", { email: "mel@harbourlift.com.au" });
    await prisma.location.update({ where: { id: "main" }, data: { name: "Harbour", addressLine1: "1 Wharf Road" } });
    await prisma.branding.create({ data: { id: "singleton", name: "Harbour Lift" } });
    const { findings } = await checkDatabase(prisma, migrations);
    expect(findings.filter((f) => f.level === "fail" || f.level === "warn")).toEqual([]);
  });
});
