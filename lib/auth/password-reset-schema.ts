import { z } from "zod";
import { zEmail, zPassword } from "@/lib/http/route";

export const ResetRequestBody = z.object({ kind: z.enum(["staff", "member"]), email: zEmail });
export const ResetTokenQuery = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,200}$/, "Invalid link") });
export const ResetBody = z.object({ token: z.string().min(20).max(200), password: zPassword });
export const VerifyEmailBody = z.object({ token: z.string().min(20).max(200) });
