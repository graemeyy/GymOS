import { ImageResponse } from "next/og";
import { getBranding, getBrandImage } from "@/lib/branding/service";

const SIZES = {
  "180": { px: 180, maskable: false, full: true },
  "192": { px: 192, maskable: false, full: false },
  "512": { px: 512, maskable: false, full: false },
  "512-maskable": { px: 512, maskable: true, full: true },
} as const;

// The app icon in each size the browser and phones ask for (D-124). The
// uploaded square icon when there is one, scaled; otherwise the plate mark
// with the gym's initials in its main colour. The maskable and Apple versions
// fill the square, with the mark inside the safe zone.
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const spec = SIZES[size as keyof typeof SIZES] ?? SIZES["192"];
  const [branding, uploaded] = await Promise.all([getBranding(), getBrandImage("icon")]);
  const headers = { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" };
  if (uploaded) {
    const src = `data:image/png;base64,${uploaded.bytes.toString("base64")}`;
    const inner = spec.maskable ? Math.round(spec.px * 0.8) : spec.px;
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: spec.full ? "#FFFFFF" : "transparent" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={src} width={inner} height={inner} />
        </div>
      ),
      { width: spec.px, height: spec.px, headers }
    );
  }
  const plate = spec.maskable ? spec.px * 0.62 : spec.full ? spec.px * 0.8 : spec.px * 0.94;
  const colour = branding.primaryColour;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: spec.full ? colour : "transparent" }}>
        <div
          style={{
            width: plate,
            height: plate,
            borderRadius: "50%",
            background: colour,
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
          {branding.logoText}
        </div>
      </div>
    ),
    { width: spec.px, height: spec.px, headers }
  );
}
