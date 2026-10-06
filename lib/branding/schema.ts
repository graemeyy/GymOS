import { z } from "zod";
import { AU_STATES, isValidAbn } from "@/lib/config/schema";
import { BODY_FONT_IDS, DISPLAY_FONT_IDS } from "./fonts";
import { HEX } from "./colour";

// What the Branding page sends. Every field is required: the page always
// sends the whole form, with config defaults pre-filled.
const text = (max: number) => z.string().trim().min(1, "Required").max(max);

export const BrandingBody = z.object({
  name: text(80),
  appName: text(20),
  tagline: text(140),
  logoText: text(3),
  primaryColour: z.string().regex(HEX, "Use a hex colour like #1F5AA6"),
  accentColour: z.string().regex(HEX, "Use a hex colour like #F2C230"),
  bodyFont: z.enum(BODY_FONT_IDS),
  displayFont: z.enum(DISPLAY_FONT_IDS),
  emailSenderName: text(60).refine((v) => !/[<>"@\r\n]/.test(v), "Letters, numbers and spaces only (no < > \" or @)"),
  emailFooter: z.string().trim().max(500),
  legalName: text(120),
  abn: z.string().trim().refine(isValidAbn, "Not a valid ABN (check digits failed)"),
  contactEmail: z.email("Enter a valid email").max(254),
  contactPhone: z.string().trim().min(8, "Enter a phone number").max(30),
  address: z.object({
    line1: text(120),
    line2: z.string().trim().max(120),
    suburb: text(60),
    state: z.enum(AU_STATES),
    postcode: z.string().regex(/^\d{4}$/, "Australian postcodes are four digits"),
  }),
});
export type BrandingInput = z.infer<typeof BrandingBody>;

// Images arrive as data URLs from the Branding page. PNG, JPEG or WebP only:
// SVG can carry scripts, so it isn't accepted.
export const MAX_IMAGE_BYTES = 256 * 1024;
export const BrandImageBody = z.object({ dataUrl: z.string().max(Math.ceil(MAX_IMAGE_BYTES * 1.4) + 100).nullable() });
export const BRAND_IMAGE_KINDS = ["logo", "icon"] as const;
export type BrandImageKind = (typeof BRAND_IMAGE_KINDS)[number];
