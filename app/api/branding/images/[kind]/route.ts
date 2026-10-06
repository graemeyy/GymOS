import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { BRAND_IMAGE_KINDS, BrandImageBody, MAX_IMAGE_BYTES, type BrandImageKind } from "@/lib/branding/schema";
import { setBrandImage } from "@/lib/branding/service";

// Uploads or removes the logo or the app icon. Sent as a data URL in JSON,
// so it keeps the same-origin and JSON-only protections as every other write.
export const PUT = staffRoute({ permission: "branding.edit", body: BrandImageBody, maxBodyBytes: Math.ceil(MAX_IMAGE_BYTES * 1.4) + 1024 }, async ({ db, staff, body, params }) => {
  if (!(BRAND_IMAGE_KINDS as readonly string[]).includes(params.kind)) throw new ApiError("not_found", "Unknown image.");
  return json(await setBrandImage(db, staff, params.kind as BrandImageKind, body.dataUrl));
});
