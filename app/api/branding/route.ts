import { staffRoute, json } from "@/lib/http/route";
import { BrandingBody } from "@/lib/branding/schema";
import { getBranding, updateBranding } from "@/lib/branding/service";

// The Branding page (D-124). Owner only by default (branding.edit).
export const GET = staffRoute({ permission: "branding.edit" }, async ({ db }) => json(await getBranding(db)));

export const PUT = staffRoute({ permission: "branding.edit", body: BrandingBody }, async ({ db, staff, body }) => json(await updateBranding(db, staff, body)));
