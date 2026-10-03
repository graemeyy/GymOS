import { ApiError } from "./errors";
import { timingSafeEqualStrings } from "@/lib/auth/token";

// Shared-secret check for machine callers (Vercel cron, door gateways).
// Fails closed: if the secret isn't configured, nobody gets in.
export function assertBearer(request: Request, secret: string | undefined, label: string) {
  if (!secret) throw new ApiError("not_configured", `${label} isn't configured on this server.`);
  const header = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStrings(header, `Bearer ${secret}`)) throw new ApiError("unauthenticated", "Invalid credentials.");
}
