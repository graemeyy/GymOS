// D-111: seeded and newly invited accounts must choose their own password
// before anything else works, enforced on the server.
import { beforeEach, describe, expect, it } from "vitest";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { hashPassword } from "@/lib/auth/password";
import { resetDatabase, seedDatabase } from "@/prisma/seed-data";
import * as dashboard from "@/app/api/dashboard/stats/route";
import * as authMe from "@/app/api/auth/me/route";
import * as staffLogin from "@/app/api/auth/login/route";
import * as memberLogin from "@/app/api/auth/member-login/route";
import * as staffPassword from "@/app/api/staff/me/password/route";
import * as me from "@/app/api/me/route";
import * as myBookings from "@/app/api/me/bookings/route";
import * as memberPassword from "@/app/api/me/password/route";
import * as staffInvite from "@/app/api/staff/invite/route";
import * as invite from "@/app/api/auth/invite/route";

beforeEach(resetDb);

const PASSWORD = "given-password-123";

async function flaggedStaff() {
  const staff = await createStaff("MANAGER");
  return prisma.staff.update({ where: { id: staff.id }, data: { mustChangePassword: true, passwordHash: await hashPassword(PASSWORD) } });
}

async function flaggedMember() {
  const member = await createMember();
  return prisma.member.update({ where: { id: member.id }, data: { mustChangePassword: true, passwordHash: await hashPassword(PASSWORD) } });
}

describe("staff who must change their password", () => {
  it("are told so at sign-in and by /api/auth/me", async () => {
    const staff = await flaggedStaff();
    const signIn = await call(staffLogin.POST, await makeRequest("POST", "/x", { body: { email: staff.email, password: PASSWORD } }));
    expect(signIn.status).toBe(200);
    expect(signIn.body.mustChangePassword).toBe(true);
    const who = await call(authMe.GET, await makeRequest("GET", "/x", { as: { staff } }));
    expect(who.body).toMatchObject({ kind: "staff", mustChangePassword: true });
  });

  it("can't use anything else until they've changed it", async () => {
    const staff = await flaggedStaff();
    const res = await call(dashboard.GET, await makeRequest("GET", "/x", { as: { staff } }));
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("password_change_required");
  });

  it("must pick a different password, and then everything works", async () => {
    const staff = await flaggedStaff();
    const as: As = { staff };
    const same = await call(staffPassword.POST, await makeRequest("POST", "/x", { as, body: { currentPassword: PASSWORD, newPassword: PASSWORD } }));
    expect(same.status).toBe(422);
    const changed = await call(staffPassword.POST, await makeRequest("POST", "/x", { as, body: { currentPassword: PASSWORD, newPassword: "my-own-password-456" } }));
    expect(changed.status).toBe(200);
    const fresh = await prisma.staff.findUniqueOrThrow({ where: { id: staff.id } });
    expect(fresh.mustChangePassword).toBe(false);
    expect((await call(dashboard.GET, await makeRequest("GET", "/x", { as: { staff: fresh } }))).status).toBe(200);
  });
});

describe("members who must change their password", () => {
  it("can read their own record but nothing else until they've changed it", async () => {
    const member = await flaggedMember();
    const signIn = await call(memberLogin.POST, await makeRequest("POST", "/x", { body: { email: member.email, password: PASSWORD } }));
    expect(signIn.body.mustChangePassword).toBe(true);
    const own = await call(me.GET, await makeRequest("GET", "/x", { as: { member } }));
    expect(own.status).toBe(200);
    expect(own.body.mustChangePassword).toBe(true);
    const bookings = await call(myBookings.GET, await makeRequest("GET", "/x", { as: { member } }));
    expect(bookings.status).toBe(403);
    expect(bookings.body.error?.code).toBe("password_change_required");

    const changed = await call(memberPassword.POST, await makeRequest("POST", "/x", { as: { member }, body: { current: PASSWORD, next: "my-own-password-456" } }));
    expect(changed.status).toBe(200);
    const fresh = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(fresh.mustChangePassword).toBe(false);
    expect((await call(myBookings.GET, await makeRequest("GET", "/x", { as: { member: fresh } }))).status).toBe(200);
  });
});

describe("where the flag is set", () => {
  it("on every seeded account that can sign in, and on nobody else", async () => {
    await resetDatabase(prisma);
    await prisma.membershipPlan.deleteMany();
    await seedDatabase(prisma, { password: "seed-password-for-this-test" });
    expect(await prisma.staff.count({ where: { mustChangePassword: false } })).toBe(0);
    expect(await prisma.member.count({ where: { passwordHash: { not: null }, mustChangePassword: false } })).toBe(0);
    expect(await prisma.member.count({ where: { passwordHash: null, mustChangePassword: true } })).toBe(0);
  });

  it("on a newly invited account, and choosing a password from the invitation clears it", async () => {
    const owner = await createStaff("OWNER");
    const res = await call(staffInvite.POST, await makeRequest("POST", "/x", { as: { staff: owner }, body: { name: "New Hire", email: "new.hire@example.com", roleId: "role_trainer" } }));
    expect(res.status).toBe(201);
    expect((await prisma.staff.findUniqueOrThrow({ where: { email: "new.hire@example.com" } })).mustChangePassword).toBe(true);
    const token = new URL((res.body as { inviteUrl: string }).inviteUrl).searchParams.get("token");
    expect((await call(invite.POST, await makeRequest("POST", "/x", { body: { token, password: "chosen-by-them-789" } }))).status).toBe(200);
    expect((await prisma.staff.findUniqueOrThrow({ where: { email: "new.hire@example.com" } })).mustChangePassword).toBe(false);
  });

  it("not on existing accounts or ones created at first-run setup", async () => {
    const staff = await createStaff("OWNER");
    expect(staff.mustChangePassword).toBe(false);
  });
});
