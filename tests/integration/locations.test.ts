import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as locations from "@/app/api/locations/route";
import * as locationById from "@/app/api/locations/[id]/route";
import * as openLocations from "@/app/api/locations/open/route";
import * as checkIn from "@/app/api/check-in/route";
import * as classes from "@/app/api/classes/route";
import * as book from "@/app/api/classes/[id]/book/route";
import * as myBooking from "@/app/api/me/classes/[id]/booking/route";
import * as myClasses from "@/app/api/me/classes/route";
import * as announcements from "@/app/api/announcements/route";
import * as publish from "@/app/api/announcements/[id]/publish/route";
import * as myAnnouncements from "@/app/api/me/announcements/route";
import * as summary from "@/app/api/finance/summary/route";
import * as payments from "@/app/api/payments/route";
import * as products from "@/app/api/products/route";
import * as variant from "@/app/api/product-variants/[id]/route";
import * as catalogue from "@/app/api/shop/products/route";
import * as shopCheckout from "@/app/api/shop/checkout/route";
import * as staffInvite from "@/app/api/staff/invite/route";
import * as staffById from "@/app/api/staff/[id]/route";
import * as me from "@/app/api/auth/me/route";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";
import { createPassToken } from "@/lib/checkin/qr";
import { captureEmailsForTests } from "@/lib/email";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, setStock, stockOf, type As } from "../helpers";
import { installFakeStripe } from "../fake-stripe";

const asMember = (m: { id: string; name: string | null; email: string; sessionVersion: number }): As => ({ member: m });
const NORTH = { name: "North", code: "north", addressLine1: "1 Example Road", addressLine2: "", suburb: "Northbridge", state: "WA", postcode: "6003", phone: null, sortOrder: 1 };

let owner: As;
let north: { id: string };

beforeEach(async () => {
  await resetDb();
  captureEmailsForTests(true);
  owner = { staff: await createStaff("OWNER") };
  north = (await call(locations.POST, await makeRequest("POST", "/x", { as: owner, body: NORTH }))).body as { id: string };
});
afterEach(() => captureEmailsForTests(false));

// A staff member whose role covers the given locations only (D-128).
async function scopedStaff(preset: "STAFF" | "MANAGER", locationIds: string[]): Promise<As> {
  const staff = await createStaff(preset);
  await prisma.staffLocation.createMany({ data: locationIds.map((locationId) => ({ staffId: staff.id, locationId })) });
  return { staff };
}

async function memberAt(homeLocationId: string, planSlug = "unlimited") {
  const m = await createMember({ planSlug });
  return prisma.member.update({ where: { id: m.id }, data: { homeLocationId } });
}

async function classAt(locationId: string) {
  return prisma.class.create({ data: { name: "Conditioning", startTime: new Date(Date.now() + 2 * 86_400_000), durationMinutes: 45, capacity: 10, locationId } });
}

describe("the default location (D-125)", () => {
  it("exists after the migrations, and new rows belong to it unless told otherwise", async () => {
    const main = await prisma.location.findUniqueOrThrow({ where: { id: MAIN_LOCATION_ID } });
    expect(main.archivedAt).toBeNull();
    const m = await createMember();
    expect(m.homeLocationId).toBe(MAIN_LOCATION_ID);
    const cls = await prisma.class.create({ data: { name: "Mobility", startTime: new Date(), durationMinutes: 30, capacity: 5 } });
    expect(cls.locationId).toBe(MAIN_LOCATION_ID);
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    expect(plan.locationAccess).toBe("ALL");
  });

  it("lists open locations publicly, by name and suburb only", async () => {
    const res = await call(openLocations.GET, await makeRequest("GET", "/x"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: MAIN_LOCATION_ID, name: "Main location", suburb: "" },
      { id: north.id, name: "North", suburb: "Northbridge" },
    ]);
  });
});

describe("managing locations", () => {
  it("needs settings.edit, refuses a duplicate code, and audits each change", async () => {
    const desk = { staff: await createStaff("STAFF") };
    expect((await call(locations.POST, await makeRequest("POST", "/x", { as: desk, body: { ...NORTH, name: "South", code: "south" } }))).status).toBe(403);
    // Anyone on staff can list them, for the location filter.
    expect((await call(locations.GET, await makeRequest("GET", "/x", { as: desk }))).status).toBe(200);

    const dup = await call(locations.POST, await makeRequest("POST", "/x", { as: owner, body: { ...NORTH, name: "Another" } }));
    expect(dup.status).toBe(409);
    expect(dup.body.error?.fields).toEqual({ code: "Already in use" });

    expect((await call(locationById.PUT, await makeRequest("PUT", "/x", { as: owner, body: { ...NORTH, phone: "08 9000 0000" } }), { id: north.id })).status).toBe(200);
    const audit = await prisma.auditLog.findMany({ where: { targetId: north.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["location.created", "location.updated"]);
    expect(audit[1].before).toEqual({ phone: null });
    expect(audit[1].after).toEqual({ phone: "08 9000 0000" });
  });

  it("won't archive the main location, or one with home members or upcoming classes", async () => {
    const patch = async (id: string, archived: boolean) => call(locationById.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { archived } }), { id });
    expect((await patch(MAIN_LOCATION_ID, true)).status).toBe(409);

    const m = await memberAt(north.id);
    expect((await patch(north.id, true)).body.error?.message).toMatch(/home location/);
    await prisma.member.update({ where: { id: m.id }, data: { homeLocationId: MAIN_LOCATION_ID } });

    const cls = await classAt(north.id);
    expect((await patch(north.id, true)).body.error?.message).toMatch(/upcoming class/);
    await prisma.class.delete({ where: { id: cls.id } });

    expect((await patch(north.id, true)).status).toBe(200);
    // Archived locations leave the pickers.
    const listed = (await call(locations.GET, await makeRequest("GET", "/x", { as: owner }))).body as unknown as { id: string }[];
    expect(listed.map((l) => l.id)).toEqual([MAIN_LOCATION_ID]);
    expect((await patch(north.id, false)).status).toBe(200);
  });
});

describe("plan access (D-126)", () => {
  it("lets a home-only member in at their home location and nowhere else", async () => {
    const desk = { staff: await createStaff("STAFF") };
    const m = await memberAt(north.id, "off-peak");
    await prisma.membershipPlan.update({ where: { slug: "off-peak" }, data: { locationAccess: "HOME" } });
    // Off-peak has its own hours rule; check in at a time it allows.
    const at = async (locationId: string) => (await call(checkIn.POST, await makeRequest("POST", "/x", { as: desk, body: { query: m.email, locationId } }))).body;
    const away = await at(MAIN_LOCATION_ID);
    expect(away.granted).toBe(false);
    expect(away.reason).toBe("Membership doesn't include this location");
    const home = await at(north.id);
    expect(home.reason).not.toBe("Membership doesn't include this location");
    // A refused visit isn't recorded.
    const visits = await prisma.checkIn.findMany({ where: { memberId: m.id }, select: { locationId: true } });
    expect(visits.map((v) => v.locationId)).toEqual([north.id]);
  });

  it("covers chosen locations only, for check-in and class bookings", async () => {
    const desk = { staff: await createStaff("STAFF") };
    const plan = await prisma.membershipPlan.update({ where: { slug: "unlimited" }, data: { locationAccess: "SELECTED", locations: { create: [{ locationId: north.id }] } } });
    const m = await memberAt(MAIN_LOCATION_ID);
    expect(plan.locationAccess).toBe("SELECTED");

    expect((await call(checkIn.POST, await makeRequest("POST", "/x", { as: desk, body: { query: m.email, locationId: MAIN_LOCATION_ID } }))).body.granted).toBe(false);
    expect((await call(checkIn.POST, await makeRequest("POST", "/x", { as: desk, body: { query: m.email, locationId: north.id } }))).body.granted).toBe(true);

    const mainClass = await classAt(MAIN_LOCATION_ID);
    const northClass = await classAt(north.id);
    const refused = await call(book.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: m.id } }), { id: mainClass.id });
    expect(refused.status).toBe(409);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: mainClass.id })).status).toBe(409);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: northClass.id })).status).toBe(201);

    // The member's timetable only shows what their plan covers.
    const timetable = (await call(myClasses.GET, await makeRequest("GET", "/x", { as: asMember(m) }))).body as unknown as { classes: { id: string }[]; locations: { id: string }[] };
    expect(timetable.classes.map((c) => c.id)).toEqual([northClass.id]);
    expect(timetable.locations.map((l) => l.id)).toEqual([north.id]);
  });
});

describe("staff limited to some locations (D-128)", () => {
  it("only work at their locations", async () => {
    const desk = await scopedStaff("STAFF", [north.id]);
    const who = (await call(me.GET, await makeRequest("GET", "/x", { as: desk }))).body;
    expect(who.locationIds).toEqual([north.id]);

    const m = await memberAt(MAIN_LOCATION_ID);
    expect((await call(checkIn.POST, await makeRequest("POST", "/x", { as: desk, body: { query: m.email, locationId: MAIN_LOCATION_ID } }))).status).toBe(403);
    expect((await call(checkIn.POST, await makeRequest("POST", "/x", { as: desk, body: { query: m.email, locationId: north.id } }))).status).toBe(200);
    // Without a location, the desk checks in at its only one.
    expect((await call(checkIn.POST, await makeRequest("POST", "/x", { as: desk, body: { query: m.email } }))).status).toBe(200);
    const visits = await prisma.checkIn.findMany({ where: { memberId: m.id }, select: { locationId: true } });
    expect(visits.every((v) => v.locationId === north.id)).toBe(true);

    const mainClass = await classAt(MAIN_LOCATION_ID);
    await classAt(north.id);
    expect((await call(book.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: m.id } }), { id: mainClass.id })).status).toBe(403);
    const listed = (await call(classes.GET, await makeRequest("GET", "/x", { as: desk }))).body as unknown as { locationId: string }[];
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((c) => c.locationId === north.id)).toBe(true);
    // Asking for another location's list is refused rather than emptied.
    expect((await call(classes.GET, await makeRequest("GET", `/x?locationId=${MAIN_LOCATION_ID}`, { as: desk }))).status).toBe(403);
  });

  it("can only give locations they cover, and owners always cover every location", async () => {
    const manager = await scopedStaff("MANAGER", [north.id]);
    await prisma.role.update({ where: { id: "role_manager" }, data: { permissions: { push: "staff.manage" } } });
    const invite = (body: Record<string, unknown>) => makeRequest("POST", "/x", { as: manager, body: { name: "New Person", email: `p${Math.random()}@example.com`, roleId: "role_staff", ...body } });
    expect((await call(staffInvite.POST, await invite({}))).status).toBe(403);
    expect((await call(staffInvite.POST, await invite({ locationIds: [MAIN_LOCATION_ID] }))).status).toBe(403);
    const ok = await call(staffInvite.POST, await invite({ locationIds: [north.id] }));
    expect(ok.status).toBe(201);

    const ownerTarget = await createStaff("OWNER");
    const res = await call(staffById.PUT, await makeRequest("PUT", "/x", { as: owner, body: { locationIds: [north.id] } }), { id: ownerTarget.id });
    expect(res.status).toBe(422);
  });
});

describe("shop stock per location (D-127)", () => {
  it("sells from the pickup location's stock and records where the order and payment belong", async () => {
    const stripe = installFakeStripe();
    try {
      const created = await call(products.POST, await makeRequest("POST", "/x", { as: owner, body: { name: "Club tee", category: "APPAREL", stockLocationId: north.id, variants: [{ sku: "T-M", size: "M", priceCents: 3500, stockQty: 2 }] } }));
      expect(created.status).toBe(201);
      const variantId = (created.body.variants as { id: string }[])[0].id;
      expect(await stockOf(variantId, north.id)).toBe(2);
      expect(await stockOf(variantId, MAIN_LOCATION_ID)).toBe(0);

      const m = await memberAt(MAIN_LOCATION_ID);
      // The catalogue shows the member's home location by default.
      const home = (await call(catalogue.GET, await makeRequest("GET", "/x", { as: asMember(m) }))).body;
      expect((home.location as { id: string }).id).toBe(MAIN_LOCATION_ID);
      const order = async (locationId: string) => call(shopCheckout.POST, await makeRequest("POST", "/x", { as: asMember(m), body: { lines: [{ variantId, quantity: 1 }], fulfilment: "PICKUP", locationId } }));
      expect((await order(MAIN_LOCATION_ID)).status).toBe(409);
      expect((await order(north.id)).status).toBe(201);
      const placed = await prisma.order.findFirstOrThrow({ where: { memberId: m.id } });
      expect(placed.locationId).toBe(north.id);
    } finally {
      stripe.restore();
    }
  });

  it("adjusts stock at one location, within the person's locations", async () => {
    const product = await prisma.product.create({ data: { name: "Chalk", slug: "chalk", category: "ACCESSORIES", variants: { create: [{ sku: "C-1", priceCents: 800 }] } }, include: { variants: true } });
    const v = product.variants[0];
    await setStock(v.id, 5, MAIN_LOCATION_ID);
    await setStock(v.id, 1, north.id);
    const desk = await scopedStaff("STAFF", [north.id]);
    await prisma.role.update({ where: { id: "role_staff" }, data: { permissions: { push: "orders.manage" } } });
    const adjust = async (locationId: string, delta: number) => call(variant.PATCH, await makeRequest("PATCH", "/x", { as: desk, body: { delta, locationId } }), { id: v.id });
    expect((await adjust(MAIN_LOCATION_ID, 1)).status).toBe(403);
    expect((await adjust(north.id, -2)).status).toBe(409);
    expect((await adjust(north.id, 3)).body.stockQty).toBe(4);
    expect(await stockOf(v.id, MAIN_LOCATION_ID)).toBe(5);

    // Their product list totals their locations only.
    const listed = (await call(products.GET, await makeRequest("GET", "/x", { as: desk }))).body as unknown as { variants: { stockQty: number; stockByLocation: Record<string, number> }[] }[];
    expect(listed[0].variants[0].stockQty).toBe(4);
    expect(Object.keys(listed[0].variants[0].stockByLocation)).toEqual([north.id]);
  });
});

describe("announcements per location", () => {
  it("reach members whose home location it is", async () => {
    const atNorth = await memberAt(north.id);
    const atMain = await memberAt(MAIN_LOCATION_ID);
    const created = await call(announcements.POST, await makeRequest("POST", "/x", { as: owner, body: { title: "North car park", body: "The car park is closed on Friday.", locationId: north.id } }));
    expect(created.status).toBe(201);
    expect((await call(publish.POST, await makeRequest("POST", "/x", { as: owner, body: { email: false } }), { id: created.body.id as string })).status).toBe(200);
    const seen = async (m: typeof atNorth) => ((await call(myAnnouncements.GET, await makeRequest("GET", "/x", { as: asMember(m) }))).body as unknown as { title: string }[]).map((a) => a.title);
    expect(await seen(atNorth)).toContain("North car park");
    expect(await seen(atMain)).not.toContain("North car park");
  });

  it("can't be sent to every location by someone who covers some", async () => {
    const manager = await scopedStaff("MANAGER", [north.id]);
    const body = { title: "Holiday hours", body: "Open 8 to 12 on Monday." };
    expect((await call(announcements.POST, await makeRequest("POST", "/x", { as: manager, body }))).status).toBe(403);
    expect((await call(announcements.POST, await makeRequest("POST", "/x", { as: manager, body: { ...body, locationId: north.id } }))).status).toBe(201);
  });
});

describe("reports per location and combined (D-129)", () => {
  beforeEach(async () => {
    const a = await memberAt(MAIN_LOCATION_ID);
    const b = await memberAt(north.id);
    const paidAt = new Date();
    await prisma.payment.create({ data: { memberId: a.id, amount: 3000, gstCents: 273, status: "succeeded", kind: "MEMBERSHIP", paidAt, locationId: MAIN_LOCATION_ID } });
    await prisma.payment.create({ data: { memberId: b.id, amount: 2000, gstCents: 182, status: "succeeded", kind: "MEMBERSHIP", paidAt, locationId: north.id } });
  });

  const takings = async (as: As, query = "") => (await call(summary.GET, await makeRequest("GET", `/x?period=this-month${query}`, { as }))).body as { grossCents: number; byLocation: { locationId: string; cents: number }[] };

  it("shows one location, or every location with the split", async () => {
    expect((await takings(owner, `&locationId=${north.id}`)).grossCents).toBe(2000);
    const all = await takings(owner);
    expect(all.grossCents).toBe(5000);
    expect(Object.fromEntries(all.byLocation.map((l) => [l.locationId, l.cents]))).toEqual({ [MAIN_LOCATION_ID]: 3000, [north.id]: 2000 });
  });

  it("limits combined reports and payment lists to the person's locations", async () => {
    const manager = await scopedStaff("MANAGER", [north.id]);
    await prisma.role.update({ where: { id: "role_manager" }, data: { permissions: { push: "finance.view" } } });
    expect((await takings(manager)).grossCents).toBe(2000);
    expect((await call(summary.GET, await makeRequest("GET", `/x?period=this-month&locationId=${MAIN_LOCATION_ID}`, { as: manager }))).status).toBe(403);
    const listed = (await call(payments.GET, await makeRequest("GET", "/x", { as: manager }))).body as unknown as { amount: number }[];
    expect(listed.map((p) => p.amount)).toEqual([2000]);
  });
});

// #25's rotating passes (D-119) and these location rules (D-126, D-128) at
// the same desk.
describe("check-in passes and location rules together", () => {
  const scanAt = async (as: As, query: string, locationId?: string) => call(checkIn.POST, await makeRequest("POST", "/x", { as, body: { query, ...(locationId ? { locationId } : {}) } }));

  it("checks the pass first, then the plan's locations; a refused visit still uses up that code", async () => {
    const desk = { staff: await createStaff("STAFF") };
    await prisma.membershipPlan.update({ where: { slug: "off-peak" }, data: { locationAccess: "HOME" } });
    const m = await memberAt(north.id, "off-peak");

    // A fresh code at a location the plan doesn't cover: refused for the location, no visit.
    const away = await createPassToken(m.id, 0);
    const refused = await scanAt(desk, away.token, MAIN_LOCATION_ID);
    expect(refused.status).toBe(200);
    expect(refused.body).toMatchObject({ granted: false, reason: "Membership doesn't include this location", method: "QR" });
    // That code counts as used (D-119), even at the member's own location.
    const reused = await scanAt(desk, away.token, north.id);
    expect(reused.status).toBe(409);
    expect(reused.body.error?.message).toContain("already been used");

    // An expired code is refused before location rules, and the refusal names the desk.
    const old = await createPassToken(m.id, 0, new Date(Date.now() - 91_000));
    expect((await scanAt(desk, old.token, north.id)).status).toBe(409);
    const expired = await prisma.auditLog.findFirstOrThrow({ where: { action: "member.check_in_refused", targetId: m.id, details: { path: ["reason"], equals: "Expired pass" } } });
    expect(expired.details).toMatchObject({ location: "Front desk, North", method: "QR" });

    // A fresh code at their home location lets them in, recorded there.
    const home = await createPassToken(m.id, 0);
    expect((await scanAt(desk, home.token, north.id)).body).toMatchObject({ granted: true, method: "QR" });
    const visits = await prisma.checkIn.findMany({ where: { memberId: m.id } });
    expect(visits.map((v) => [v.locationId, v.method])).toEqual([[north.id, "QR"]]);
  });

  it("doesn't use up a pass scanned at a desk outside the person's locations", async () => {
    const desk = await scopedStaff("STAFF", [north.id]);
    const m = await memberAt(MAIN_LOCATION_ID);
    const pass = await createPassToken(m.id, 0);
    // The desk's location is checked before the pass, so the code survives.
    expect((await scanAt(desk, pass.token, MAIN_LOCATION_ID)).status).toBe(403);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).passUsedIssuedAt).toBeNull();
    // At the desk's own location (its only one, so it needn't say) the same code works.
    expect((await scanAt(desk, pass.token)).body).toMatchObject({ granted: true, method: "QR" });
    expect((await prisma.checkIn.findFirstOrThrow({ where: { memberId: m.id } })).locationId).toBe(north.id);
  });
});
