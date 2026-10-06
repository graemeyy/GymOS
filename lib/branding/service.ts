import { cache } from "react";
import { connection } from "next/server";
import { prisma, type Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import type { StaffActor } from "@/lib/auth/session";
import { contrastChecks } from "./colour";
import { MAX_IMAGE_BYTES, type BrandImageKind, type BrandingInput } from "./schema";
import type { Branding } from "./types";
import { brandingFrom } from "./defaults";

export { brandingFrom, defaultFooter } from "./defaults";

const ID = "singleton";

// One read per request (React's cache), so every component and email on a
// page sees the same branding. If the database can't be reached, the config
// defaults keep public pages up rather than failing every request.
export const getBranding = cache(async (db: Db = prisma): Promise<Branding> => {
  try {
    return brandingFrom(await db.branding.findUnique({ where: { id: ID } }));
  } catch (error) {
    console.error("Couldn't read branding; using the defaults from config.", error instanceof Error ? error.message : error);
    return brandingFrom(null);
  }
});

// For pages and layouts: marks the render as per-request first, so
// `npm run build` never reads the database while prerendering.
export async function brandingForPage(): Promise<Branding> {
  await connection();
  return getBranding();
}

function rowFrom(input: BrandingInput) {
  return {
    name: input.name,
    appName: input.appName,
    tagline: input.tagline,
    logoText: input.logoText,
    primaryColour: input.primaryColour.toUpperCase(),
    accentColour: input.accentColour.toUpperCase(),
    bodyFont: input.bodyFont,
    displayFont: input.displayFont,
    emailSenderName: input.emailSenderName,
    emailFooter: input.emailFooter,
    legalName: input.legalName,
    abn: input.abn,
    contactEmail: input.contactEmail.toLowerCase(),
    contactPhone: input.contactPhone,
    addressLine1: input.address.line1,
    addressLine2: input.address.line2,
    suburb: input.address.suburb,
    state: input.address.state,
    postcode: input.address.postcode,
  };
}

function flatten(b: Branding) {
  const { address, logoUrl: _logo, iconUrl: _icon, ...rest } = b;
  return { ...rest, ...Object.fromEntries(Object.entries(address).map(([k, v]) => [`address.${k}`, v])) } as Record<string, string>;
}

// Saves the whole form. Colours that fail any contrast check are refused, so
// the app can't be made unreadable (D-124). The audit entry holds only what
// changed.
export async function updateBranding(db: Db, staff: StaffActor, input: BrandingInput): Promise<Branding> {
  const failing = contrastChecks(input.primaryColour, input.accentColour).filter((c) => !c.ok);
  if (failing.length) {
    throw new ApiError("validation_failed", "Those colours aren't readable enough.", { primaryColour: failing.map((c) => `${c.label}: ${c.ratio}:1, needs 4.5:1. ${c.fix}`).join(" ") });
  }
  return db.$transaction(async (tx) => {
    const beforeRow = await tx.branding.findUnique({ where: { id: ID } });
    const before = flatten(brandingFrom(beforeRow));
    const data = rowFrom(input);
    const row = await tx.branding.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
    const after = brandingFrom(row);
    const flatAfter = flatten(after);
    const changed = Object.keys(flatAfter).filter((k) => flatAfter[k] !== before[k]);
    if (changed.length) {
      await logAction(tx, staff, {
        action: "branding.updated",
        targetType: "Branding",
        targetId: ID,
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, flatAfter[k]])),
      });
    }
    return after;
  });
}

const SIGNATURES: { type: string; test: (b: Buffer) => boolean }[] = [
  { type: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

function pngSize(b: Buffer): { width: number; height: number } {
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// Checks an upload by its bytes, not its claimed type. The logo can be PNG,
// JPEG or WebP; the app icon must be a square PNG of at least 192 pixels,
// because phones install it as is.
export function readImage(kind: BrandImageKind, dataUrl: string): { bytes: Buffer; type: string } {
  const match = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new ApiError("validation_failed", "That file isn't an image.", { dataUrl: "Choose a PNG, JPEG or WebP image." });
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ApiError("validation_failed", "That image is too big.", { dataUrl: "Images can be at most 256 KB." });
  const type = SIGNATURES.find((s) => s.test(bytes))?.type;
  if (!type) throw new ApiError("validation_failed", "That file isn't a PNG, JPEG or WebP image.", { dataUrl: "Choose a PNG, JPEG or WebP image. SVG isn't accepted." });
  if (kind === "icon") {
    if (type !== "image/png") throw new ApiError("validation_failed", "The app icon must be a PNG.", { dataUrl: "Use a square PNG, at least 192 by 192 pixels." });
    const { width, height } = pngSize(bytes);
    if (width !== height || width < 192) throw new ApiError("validation_failed", "The app icon must be square.", { dataUrl: `Use a square PNG, at least 192 by 192 pixels (this one is ${width} by ${height}).` });
  }
  return { bytes, type };
}

// Sets or removes the logo or app icon. Recorded without the image itself.
export async function setBrandImage(db: Db, staff: StaffActor, kind: BrandImageKind, dataUrl: string | null): Promise<Branding> {
  const image = dataUrl ? readImage(kind, dataUrl) : null;
  const data =
    kind === "logo"
      ? { logoData: image ? image.bytes : null, logoType: image?.type ?? null, imagesUpdatedAt: new Date() }
      : { iconData: image ? image.bytes : null, imagesUpdatedAt: new Date() };
  return db.$transaction(async (tx) => {
    const row = await tx.branding.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
    await logAction(tx, staff, {
      action: image ? `branding.${kind}_uploaded` : `branding.${kind}_removed`,
      targetType: "Branding",
      targetId: ID,
      details: image ? { type: image.type, bytes: image.bytes.length } : {},
    });
    return brandingFrom(row);
  });
}

export async function getBrandImage(kind: BrandImageKind, db: Db = prisma): Promise<{ bytes: Buffer; type: string } | null> {
  const row = await db.branding.findUnique({ where: { id: ID }, select: { logoData: true, logoType: true, iconData: true } });
  if (kind === "logo") return row?.logoData ? { bytes: Buffer.from(row.logoData), type: row.logoType ?? "image/png" } : null;
  return row?.iconData ? { bytes: Buffer.from(row.iconData), type: "image/png" } : null;
}
