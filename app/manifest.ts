import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/branding/service";

export const dynamic = "force-dynamic";

// Lets members add the app to their home screen, under the gym's app name and
// icon (D-124). It opens on their membership, where the pass and bookings are.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await getBranding();
  const v = b.iconUrl ? `?${b.iconUrl.split("?")[1]}` : "";
  return {
    name: b.name,
    short_name: b.appName,
    description: b.tagline,
    start_url: "/member",
    scope: "/",
    display: "standalone",
    background_color: "#EFF1EF",
    theme_color: b.primaryColour,
    lang: "en-AU",
    icons: [
      { src: `/pwa-icon/192${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/pwa-icon/512${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/pwa-icon/512-maskable${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
