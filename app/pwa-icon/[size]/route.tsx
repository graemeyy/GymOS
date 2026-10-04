import { ImageResponse } from "next/og";
import { gym } from "@/lib/config";

const SIZES = { "192": { px: 192, maskable: false }, "512": { px: 512, maskable: false }, "512-maskable": { px: 512, maskable: true } } as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

// The plate mark as a PNG app icon. The maskable version fills the square
// and keeps the plate inside the safe zone, so Android can crop it to any
// shape.
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const spec = SIZES[size as keyof typeof SIZES] ?? SIZES["192"];
  const plate = spec.maskable ? spec.px * 0.62 : spec.px * 0.94;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: spec.maskable ? "#1F5AA6" : "transparent" }}>
        <div
          style={{
            width: plate,
            height: plate,
            borderRadius: "50%",
            background: "#1F5AA6",
            border: `${Math.round(plate * 0.03)}px solid rgba(255,255,255,0.4)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            fontSize: plate * 0.36,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          {gym.brand.logoText}
        </div>
      </div>
    ),
    { width: spec.px, height: spec.px }
  );
}
