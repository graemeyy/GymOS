import type { Branding as BrandingRow } from "@prisma/client";
import { gym } from "@/lib/config/client";
import { BODY_FONT_IDS, DISPLAY_FONT_IDS, type BodyFontId, type DisplayFontId } from "./fonts";
import type { Branding } from "./types";
import { HEX } from "./colour";

// Config defaults for anything the Branding page hasn't set (D-124). Uses
// the browser copy of the config, so the provider can fall back to it too.

function pick<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function colour(value: string | null | undefined): string | null {
  return value && HEX.test(value) ? value : null;
}

export function defaultFooter(b: { name: string; contactPhone: string; contactEmail: string }): string {
  return `${b.name}\n${b.contactPhone}, ${b.contactEmail}`;
}

// The row with config defaults filled in.
export function brandingFrom(row: BrandingRow | null): Branding {
  const c = gym;
  const name = row?.name ?? c.brand.name;
  const contactPhone = row?.contactPhone ?? c.business.phone;
  const contactEmail = row?.contactEmail ?? c.business.email;
  const version = row?.imagesUpdatedAt?.getTime();
  return {
    name,
    appName: row?.appName ?? c.brand.shortName,
    tagline: row?.tagline ?? c.brand.tagline,
    logoText: row?.logoText ?? c.brand.logoText,
    // Checked again here, because these go into an inline stylesheet.
    primaryColour: colour(row?.primaryColour) ?? c.brand.primaryColour,
    accentColour: colour(row?.accentColour) ?? c.brand.accentColour,
    bodyFont: pick<BodyFontId>(row?.bodyFont, BODY_FONT_IDS, c.brand.bodyFont),
    displayFont: pick<DisplayFontId>(row?.displayFont, DISPLAY_FONT_IDS, c.brand.displayFont),
    emailSenderName: row?.emailSenderName ?? name,
    emailFooter: row?.emailFooter ?? defaultFooter({ name, contactPhone, contactEmail }),
    legalName: row?.legalName ?? c.business.legalName,
    abn: row?.abn ?? c.business.abn,
    contactEmail,
    contactPhone,
    address: {
      line1: row?.addressLine1 ?? c.business.address.line1,
      line2: row?.addressLine2 ?? c.business.address.line2,
      suburb: row?.suburb ?? c.business.address.suburb,
      state: row?.state ?? c.business.address.state,
      postcode: row?.postcode ?? c.business.address.postcode,
    },
    logoUrl: row?.logoData ? `/brand/logo?v=${version}` : null,
    iconUrl: row?.iconData ? `/brand/icon?v=${version}` : null,
  };
}

