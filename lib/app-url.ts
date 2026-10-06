import { env, type ServerEnv } from "@/lib/env";

type UrlSource = Pick<ServerEnv, "NEXT_PUBLIC_APP_URL" | "VERCEL_ENV" | "VERCEL_URL" | "VERCEL_PROJECT_PRODUCTION_URL">;

const LOCAL = "http://localhost:3000";

// The site's base URL, for every link the app writes: staff invites, emails
// and Stripe return addresses (D-109). An explicit NEXT_PUBLIC_APP_URL wins.
// Without it, Vercel's own variables give the production domain on
// production and the deployment's own address on previews; anywhere else,
// localhost. Vercel's variables are host names without a scheme.
export function resolveAppUrl(source: UrlSource): string {
  const explicit = source.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (source.VERCEL_ENV === "production" && source.VERCEL_PROJECT_PRODUCTION_URL) return `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (source.VERCEL_URL) return `https://${source.VERCEL_URL}`;
  return LOCAL;
}

/** An absolute link to a path on this site, e.g. appUrl("/member"). */
export function appUrl(path = ""): string {
  const base = resolveAppUrl(env());
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// For the setup check (D-132), which reports whether the address is set
// without reading the variable itself.
export const APP_URL_VARIABLE = "NEXT_PUBLIC_APP_URL";

/** The address set explicitly for this copy, if any. */
export function explicitAppUrl(source: Partial<Record<string, string | undefined>>): string | undefined {
  return source[APP_URL_VARIABLE] || undefined;
}
