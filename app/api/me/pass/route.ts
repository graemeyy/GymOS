import QRCode from "qrcode";
import { memberRoute, json } from "@/lib/http/route";
import { createPassToken } from "@/lib/checkin/qr";

// The member's QR pass, as the token and a ready-to-show SVG. The front desk
// scanner checks status at scan time, so a pass for a paused or overdue
// membership shows, but won't let them in.
export const GET = memberRoute({}, async ({ db, member }) => {
  const me = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { qrVersion: true, status: true, name: true } });
  const token = await createPassToken(member.id, me.qrVersion);
  // Always dark on white with a quiet zone: scanners read that reliably,
  // whatever theme the phone is in.
  const svg = await QRCode.toString(token, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  return json(
    { token, status: me.status, name: me.name, svgDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` },
    200,
    { "Cache-Control": "no-store" }
  );
});
