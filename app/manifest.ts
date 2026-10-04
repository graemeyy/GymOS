import type { MetadataRoute } from "next";
import { gym } from "@/lib/config";

// Lets members add the app to their home screen. It opens on their
// membership, where the pass and bookings are.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: gym.brand.name,
    short_name: gym.brand.shortName,
    description: gym.brand.tagline,
    start_url: "/member",
    scope: "/",
    display: "standalone",
    background_color: "#EFF1EF",
    theme_color: "#1F5AA6",
    lang: "en-AU",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
