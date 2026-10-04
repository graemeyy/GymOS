import { ImageResponse } from "next/og";
import { gym } from "@/lib/config";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home screen icon: a full square (iOS rounds the corners itself).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1F5AA6", color: "#FFFFFF", fontSize: 64, fontWeight: 700 }}>
        {gym.brand.logoText}
      </div>
    ),
    size
  );
}
