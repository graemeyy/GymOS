// Characterisation tests for the code-standard rewrite (PR 5). They pin the
// shape of every GET response (keys and value types, not values, since seed
// data is relative to today) so moving queries out of route handlers can't
// silently drop or rename a field. Update the snapshot only for an
// intentional API change.
import { beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "@/prisma/seed-data";
import { call, makeRequest, prisma, resetDb, type As } from "../helpers";

import * as adminPlans from "@/app/api/admin/plans/route";
import * as agentActions from "@/app/api/agent-actions/route";
import * as announcements from "@/app/api/announcements/route";
import * as auditExport from "@/app/api/audit-log/export/route";
import * as auditLog from "@/app/api/audit-log/route";
import * as bootstrap from "@/app/api/auth/bootstrap/route";
import * as authMe from "@/app/api/auth/me/route";
import * as overdue from "@/app/api/billing/overdue/route";
import * as checkIn from "@/app/api/check-in/route";
import * as classTemplates from "@/app/api/class-templates/route";
import * as classes from "@/app/api/classes/route";
import * as dashboard from "@/app/api/dashboard/stats/route";
import * as equipment from "@/app/api/equipment/route";
import * as financeExport from "@/app/api/finance/export/route";
import * as financeSummary from "@/app/api/finance/summary/route";
import * as inventory from "@/app/api/inventory/route";
import * as meAccount from "@/app/api/me/account/route";
import * as meAnnouncements from "@/app/api/me/announcements/route";
import * as meBookings from "@/app/api/me/bookings/route";
import * as meClasses from "@/app/api/me/classes/route";
import * as meExport from "@/app/api/me/export/route";
import * as meMembership from "@/app/api/me/membership/route";
import * as meOrder from "@/app/api/me/orders/[id]/route";
import * as meOrders from "@/app/api/me/orders/route";
import * as mePass from "@/app/api/me/pass/route";
import * as meInvoice from "@/app/api/me/payments/[id]/invoice/route";
import * as mePayments from "@/app/api/me/payments/route";
import * as me from "@/app/api/me/route";
import * as memberBenefits from "@/app/api/members/[id]/benefits/route";
import * as memberEvents from "@/app/api/members/[id]/events/route";
import * as memberNotes from "@/app/api/members/[id]/notes/route";
import * as memberById from "@/app/api/members/[id]/route";
import * as members from "@/app/api/members/route";
import * as order from "@/app/api/orders/[id]/route";
import * as orders from "@/app/api/orders/route";
import * as paymentInvoice from "@/app/api/payments/[id]/invoice/route";
import * as payment from "@/app/api/payments/[id]/route";
import * as payments from "@/app/api/payments/route";
import * as plans from "@/app/api/plans/route";
import * as product from "@/app/api/products/[id]/route";
import * as products from "@/app/api/products/route";
import * as features from "@/app/api/settings/features/route";
import * as shifts from "@/app/api/shifts/route";
import * as shopProducts from "@/app/api/shop/products/route";
import * as staff from "@/app/api/staff/route";
import * as staffDirectory from "@/app/api/staff/directory/route";
import * as roles from "@/app/api/roles/route";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/;

// The type structure of a JSON value. Arrays list each distinct element shape.
function shape(value: unknown): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    const shapes = new Map(value.map((v) => {
      const s = shape(v);
      return [JSON.stringify(s), s] as const;
    }));
    return [...shapes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, s]) => s);
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value as object).sort().map((k) => [k, shape((value as Record<string, unknown>)[k])]));
  }
  if (typeof value === "string") return ISO_DATE.test(value) ? "date" : "string";
  return typeof value;
}

type Handler = Parameters<typeof call>[0];
let owner: As;
let member: As;
const ids: Record<string, string> = {};

beforeAll(async () => {
  await resetDb();
  await prisma.membershipPlan.deleteMany();
  await seedDatabase(prisma, { password: "integration-seed-password" });
  // Seeded accounts must change their password first (D-111); these shapes
  // are about everything after that.
  await prisma.staff.updateMany({ data: { mustChangePassword: false } });
  await prisma.member.updateMany({ data: { mustChangePassword: false } });
  const o = await prisma.staff.findUniqueOrThrow({ where: { email: "owner@example.com" } });
  const m = await prisma.member.findUniqueOrThrow({ where: { email: "charlotte.pham@example.com" } });
  owner = { staff: o };
  member = { member: m };
  ids.member = m.id;
  ids.order = (await prisma.order.findFirstOrThrow({ where: { memberId: m.id }, orderBy: { createdAt: "asc" } })).id;
  ids.payment = (await prisma.payment.findFirstOrThrow({ where: { memberId: m.id }, orderBy: { invoiceNumber: "asc" } })).id;
  ids.product = (await prisma.product.findFirstOrThrow({ orderBy: { slug: "asc" } })).id;
}, 120_000);

const staffGets: [string, Handler, string, (() => Record<string, string>)?][] = [
  ["admin/plans", adminPlans.GET, "/api/admin/plans"],
  ["agent-actions", agentActions.GET, "/api/agent-actions"],
  ["announcements", announcements.GET, "/api/announcements"],
  ["audit-log", auditLog.GET, "/api/audit-log?take=20"],
  ["billing/overdue", overdue.GET, "/api/billing/overdue"],
  ["check-in", checkIn.GET, "/api/check-in"],
  ["class-templates", classTemplates.GET, "/api/class-templates"],
  ["classes", classes.GET, "/api/classes"],
  ["dashboard/stats", dashboard.GET, "/api/dashboard/stats"],
  ["equipment", equipment.GET, "/api/equipment"],
  ["finance/summary", financeSummary.GET, "/api/finance/summary?period=financial-year"],
  ["inventory", inventory.GET, "/api/inventory"],
  ["members", members.GET, "/api/members"],
  ["members/[id]", memberById.GET, "/x", () => ({ id: ids.member })],
  ["members/[id]/benefits", memberBenefits.GET, "/x", () => ({ id: ids.member })],
  ["members/[id]/events", memberEvents.GET, "/x", () => ({ id: ids.member })],
  ["members/[id]/notes", memberNotes.GET, "/x", () => ({ id: ids.member })],
  ["orders", orders.GET, "/api/orders"],
  ["orders/[id]", order.GET, "/x", () => ({ id: ids.order })],
  ["payments", payments.GET, "/api/payments"],
  ["payments/[id]", payment.GET, "/x", () => ({ id: ids.payment })],
  ["payments/[id]/invoice", paymentInvoice.GET, "/x", () => ({ id: ids.payment })],
  ["products", products.GET, "/api/products"],
  ["products/[id]", product.GET, "/x", () => ({ id: ids.product })],
  ["settings/features", features.GET, "/api/settings/features"],
  ["shifts", shifts.GET, "/api/shifts"],
  ["staff", staff.GET, "/api/staff"],
  // Added with PR 6.
  ["staff/directory", staffDirectory.GET, "/api/staff/directory"],
  ["roles", roles.GET, "/api/roles"],
];

const memberGets: [string, Handler, string, (() => Record<string, string>)?][] = [
  ["me", me.GET, "/api/me"],
  ["me/account", meAccount.GET, "/api/me/account"],
  ["me/announcements", meAnnouncements.GET, "/api/me/announcements"],
  ["me/bookings", meBookings.GET, "/api/me/bookings"],
  ["me/classes", meClasses.GET, "/api/me/classes"],
  ["me/export", meExport.GET, "/api/me/export"],
  ["me/membership", meMembership.GET, "/api/me/membership"],
  ["me/orders", meOrders.GET, "/api/me/orders"],
  ["me/orders/[id]", meOrder.GET, "/x", () => ({ id: ids.order })],
  ["me/pass", mePass.GET, "/api/me/pass"],
  ["me/payments", mePayments.GET, "/api/me/payments"],
  ["me/payments/[id]/invoice", meInvoice.GET, "/x", () => ({ id: ids.payment })],
];

async function capture(handler: Handler, path: string, as: As, params: Record<string, string> = {}) {
  const res = await call(handler, await makeRequest("GET", path, { as }), params);
  const type = res.headers.get("content-type") ?? "";
  // CSVs: the first column header, skipping "#" notes that name the period.
  const body = type.includes("json") ? shape(res.body) : String(res.body).split("\n").find((l) => !l.startsWith("#"));
  return { status: res.status, type: type.split(";")[0], body };
}

describe("GET response shapes (characterisation)", () => {
  it.each(staffGets)("staff %s", async (name, handler, path, params) => {
    expect(await capture(handler, path, owner, params?.())).toMatchSnapshot();
  });

  it.each(memberGets)("member %s", async (name, handler, path, params) => {
    expect(await capture(handler, path, member, params?.())).toMatchSnapshot();
  });

  it("public endpoints", async () => {
    expect(await capture(plans.GET, "/api/plans", null)).toMatchSnapshot();
    expect(await capture(shopProducts.GET, "/api/shop/products", null)).toMatchSnapshot();
    expect(await capture(bootstrap.GET, "/api/auth/bootstrap", null)).toMatchSnapshot();
    expect(await capture(authMe.GET, "/api/auth/me", owner)).toMatchSnapshot();
    expect(await capture(authMe.GET, "/api/auth/me", member)).toMatchSnapshot();
  });

  it("CSV exports keep their columns", async () => {
    expect(await capture(auditExport.GET, "/api/audit-log/export", owner)).toMatchSnapshot();
    for (const type of ["summary", "payments", "refunds"]) {
      expect(await capture(financeExport.GET, `/api/finance/export?type=${type}&period=financial-year`, owner)).toMatchSnapshot();
    }
  });
});
