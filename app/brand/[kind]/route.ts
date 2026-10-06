import { NextResponse } from "next/server";
import { BRAND_IMAGE_KINDS, type BrandImageKind } from "@/lib/branding/schema";
import { getBrandImage } from "@/lib/branding/service";

// The uploaded logo and app icon, for every page, email and the installed
// app. Links carry a version (?v=), so they can be cached for a year.
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(BRAND_IMAGE_KINDS as readonly string[]).includes(kind)) return new NextResponse("Not found", { status: 404 });
  const image = await getBrandImage(kind as BrandImageKind);
  if (!image) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
