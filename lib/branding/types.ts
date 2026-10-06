import type { BodyFontId, DisplayFontId } from "./fonts";

// The gym's branding with config defaults filled in (D-124). No imports
// beyond types, so browser code can use it.
export interface Branding {
  name: string;
  appName: string;
  tagline: string;
  logoText: string;
  primaryColour: string;
  accentColour: string;
  bodyFont: BodyFontId;
  displayFont: DisplayFontId;
  emailSenderName: string;
  emailFooter: string;
  legalName: string;
  abn: string;
  contactEmail: string;
  contactPhone: string;
  address: { line1: string; line2: string; suburb: string; state: string; postcode: string };
  // Versioned URLs, so a new upload isn't hidden by a cached old one. Null
  // when nothing has been uploaded.
  logoUrl: string | null;
  iconUrl: string | null;
}

export function formatBrandAddress(a: Branding["address"]): string {
  return [a.line1, a.line2, `${a.suburb} ${a.state} ${a.postcode}`].filter(Boolean).join(", ");
}
