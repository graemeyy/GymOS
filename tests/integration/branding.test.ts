// D-124: branding lives in the database, with config defaults, and only the
// owner (branding.edit) can change it.
import { deflateSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { gym } from "@/lib/config";
import { captureEmailsForTests, capturedEmails, sendEmail, signature } from "@/lib/email";
import { getBranding } from "@/lib/branding/service";
import * as branding from "@/app/api/branding/route";
import * as images from "@/app/api/branding/images/[kind]/route";
import * as brandImage from "@/app/brand/[kind]/route";
import * as invoice from "@/app/api/payments/[id]/invoice/route";
import * as financeExport from "@/app/api/finance/export/route";
import manifest from "@/app/manifest";

let owner: As;

beforeEach(async () => {
  await resetDb();
  owner = { staff: await createStaff("OWNER") };
});
afterEach(() => captureEmailsForTests(false));

// A real PNG of the given size (a solid colour), built by hand.
function png(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x40)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const dataUrl = (bytes: Buffer, type = "image/png") => `data:${type};base64,${bytes.toString("base64")}`;

async function current() {
  return (await call(branding.GET, await makeRequest("GET", "/x", { as: owner }))).body as unknown as Awaited<ReturnType<typeof getBranding>>;
}
function formFrom(b: Awaited<ReturnType<typeof getBranding>>) {
  const { logoUrl: _l, iconUrl: _i, ...rest } = b;
  return rest;
}
const put = async (body: unknown, as: As = owner) => call(branding.PUT, await makeRequest("PUT", "/x", { as, body }));

describe("defaults", () => {
  it("come from config when nothing has been saved", async () => {
    const b = await current();
    expect(b).toMatchObject({ name: gym.brand.name, appName: gym.brand.shortName, primaryColour: gym.brand.primaryColour, legalName: gym.business.legalName, abn: gym.business.abn, logoUrl: null, iconUrl: null });
    expect(b.emailFooter).toContain(gym.business.phone);
  });
});

describe("saving branding", () => {
  it("changes what members see, emails and invoices, and records only what changed", async () => {
    const before = await current();
    const res = await put({ ...formFrom(before), name: "Harbour Lift Club", appName: "Harbour", primaryColour: "#7A1F3D", legalName: "Harbour Lift Club Pty Ltd", emailSenderName: "Harbour Lift Club", emailFooter: "Harbour Lift Club\nSee you on the floor." });
    expect(res.status).toBe(200);
    expect(await getBranding()).toMatchObject({ name: "Harbour Lift Club", appName: "Harbour", primaryColour: "#7A1F3D" });

    captureEmailsForTests(true);
    await sendEmail({ to: "sam@example.com", subject: "Hello", text: `Hi${await signature()}` });
    const email = capturedEmails()[0];
    expect(email.from).toBe(`Harbour Lift Club <${gym.business.email}>`);
    expect(email.text).toContain("See you on the floor.");

    const m = await createMember();
    const payment = await prisma.payment.create({ data: { memberId: m.id, amount: 3995, gstCents: 363, status: "succeeded" } });
    const inv = await call(invoice.GET, await makeRequest("GET", "/x", { as: owner }), { id: payment.id });
    expect(inv.body).toMatchObject({ seller: { name: "Harbour Lift Club Pty Ltd" } });
    const csv = await (await financeExport.GET(await makeRequest("GET", "/x?type=summary", { as: owner }), { params: Promise.resolve({}) })).text();
    expect(csv).toContain("Harbour Lift Club Pty Ltd");

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "branding.updated" } });
    expect(Object.keys(entry.after as object).sort()).toEqual(["appName", "emailFooter", "emailSenderName", "legalName", "name", "primaryColour"]);
    expect(entry.before).toMatchObject({ name: gym.brand.name, primaryColour: gym.brand.primaryColour });
  });

  it("refuses colours that aren't readable, saying which pairs fail", async () => {
    const res = await put({ ...formFrom(await current()), primaryColour: "#F2C230" });
    expect(res.status).toBe(422);
    expect(res.body.error?.fields?.primaryColour).toMatch(/Links and outlines on the page \(light mode\): [\d.]+:1, needs 4\.5:1/);
    expect(await prisma.branding.count()).toBe(0);
  });

  it("validates the business details and the sender name", async () => {
    const res = await put({ ...formFrom(await current()), abn: "12 345 678 901", emailSenderName: "Evil <x@y.z>", bodyFont: "comic-sans" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error?.fields ?? {})).toEqual(expect.arrayContaining(["abn", "emailSenderName", "bodyFont"]));
  });

  it("is the owner's: Admin and Manager can't see or change it unless given branding.edit", async () => {
    for (const role of ["ADMIN", "MANAGER", "STAFF"] as const) {
      const as = { staff: await createStaff(role) };
      expect((await call(branding.GET, await makeRequest("GET", "/x", { as }))).status, role).toBe(403);
      expect((await put(formFrom(await current()), as)).status, role).toBe(403);
    }
  });
});

describe("logo and app icon", () => {
  const upload = async (kind: string, body: unknown) => call(images.PUT, await makeRequest("PUT", "/x", { as: owner, body }), { kind });

  it("store a logo, serve it with a versioned link, and record the upload without the image", async () => {
    const res = await upload("logo", { dataUrl: dataUrl(png(300, 100)) });
    expect(res.status).toBe(200);
    expect(res.body.logoUrl).toMatch(/^\/brand\/logo\?v=\d+$/);
    const served = await brandImage.GET(new Request("http://localhost:3000/brand/logo"), { params: Promise.resolve({ kind: "logo" }) });
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toContain("immutable");
    expect(served.headers.get("content-security-policy")).toContain("sandbox");
    expect(Buffer.from(await served.arrayBuffer()).subarray(1, 4).toString()).toBe("PNG");
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "branding.logo_uploaded" } });
    expect(entry.details).toEqual({ type: "image/png", bytes: expect.any(Number) });
    expect((await upload("logo", { dataUrl: null })).body.logoUrl).toBeNull();
  });

  it("only take a square PNG of at least 192 pixels as the app icon", async () => {
    expect((await upload("icon", { dataUrl: dataUrl(png(512, 512)) })).status).toBe(200);
    expect((await upload("icon", { dataUrl: dataUrl(png(512, 256)) })).body.error?.fields?.dataUrl).toMatch(/square/);
    expect((await upload("icon", { dataUrl: dataUrl(png(128, 128)) })).status).toBe(422);
    expect((await manifest()).icons?.[0].src).toMatch(/^\/pwa-icon\/192\?v=\d+$/);
  });

  it("check the bytes, not the claimed type, and refuse SVG and anything too big", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await upload("logo", { dataUrl: dataUrl(svg, "image/png") })).status).toBe(422);
    expect((await upload("logo", { dataUrl: dataUrl(svg, "image/svg+xml") })).status).toBe(422);
    // Over 256 KB: refused by the size check, or before that by the body limit.
    expect([413, 422]).toContain((await upload("logo", { dataUrl: dataUrl(Buffer.concat([png(10, 10), Buffer.alloc(300 * 1024)])) })).status);
    expect(await prisma.branding.count({ where: { logoData: { not: null } } })).toBe(0);
    expect((await upload("banner", { dataUrl: dataUrl(png(10, 10)) })).status).toBe(404);
  });
});

describe("the installed app", () => {
  it("uses the app name from the Branding page", async () => {
    await put({ ...formFrom(await current()), appName: "Harbour" });
    expect(await manifest()).toMatchObject({ short_name: "Harbour", theme_color: gym.brand.primaryColour });
  });
});
