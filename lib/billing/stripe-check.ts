import { resolveAppUrl } from "@/lib/app-url";
import { STRIPE_EVENT_PURPOSE, STRIPE_WEBHOOK_EVENTS } from "./events";

// `npm run stripe:check` (D-117): is this environment ready for Stripe test
// mode? It looks at which kind of key is set, never at its value, and never
// prints one.

export interface Finding {
  level: "ok" | "note" | "warn" | "fail";
  message: string;
}

export const WEBHOOK_PATH = "/api/webhooks/stripe";

type Env = Record<string, string | undefined>;

// The site the webhook should point at, chosen the same way as every other
// link the app writes (D-109). Pass --url to check a different site, such as
// production from a laptop.
export function siteUrl(env: Env): string {
  return resolveAppUrl(env);
}

export function checkStripeEnv(env: Env, apiVersion: string): Finding[] {
  const findings: Finding[] = [];
  const key = env.STRIPE_SECRET_KEY ?? "";
  if (!key) findings.push({ level: "fail", message: "STRIPE_SECRET_KEY isn't set. Copy the secret key from the Stripe dashboard with Test mode on." });
  else if (/^(sk|rk)_test_/.test(key)) findings.push({ level: "ok", message: `STRIPE_SECRET_KEY is a test-mode ${key.startsWith("rk_") ? "restricted " : ""}key.` });
  else if (/^(sk|rk)_live_/.test(key)) findings.push({ level: "fail", message: "STRIPE_SECRET_KEY is a LIVE key. Use a test-mode key (sk_test_...) until you're ready to take real money." });
  else findings.push({ level: "fail", message: "STRIPE_SECRET_KEY doesn't look like a Stripe secret key (it should start with sk_test_)." });

  const secret = env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) findings.push({ level: "fail", message: "STRIPE_WEBHOOK_SECRET isn't set. Copy the signing secret from the webhook endpoint in the Stripe dashboard." });
  else if (secret.startsWith("whsec_")) findings.push({ level: "ok", message: "STRIPE_WEBHOOK_SECRET is set." });
  else findings.push({ level: "fail", message: "STRIPE_WEBHOOK_SECRET doesn't look like a webhook signing secret (it should start with whsec_)." });

  if (env.STRIPE_ALLOW_LIVE_KEYS === "true") findings.push({ level: "warn", message: "STRIPE_ALLOW_LIVE_KEYS is true, so a live key would be accepted. Leave it unset for testing." });
  findings.push({ level: "note", message: `The webhook endpoint's API version must be ${apiVersion}.` });
  return findings;
}

/** The events the webhook endpoint must send, with what each is for. */
export function requiredEvents(): string[] {
  return STRIPE_WEBHOOK_EVENTS.map((e) => `${e}: ${STRIPE_EVENT_PURPOSE[e]}`);
}

// With --remote: asks Stripe (read-only, test mode only) whether a webhook
// endpoint points at this site and sends every event GymOS needs.
export interface RemoteEndpoint {
  url: string;
  status: string;
  enabled_events: string[];
  api_version?: string | null;
  livemode: boolean;
}

export function checkEndpoints(endpoints: RemoteEndpoint[], webhookUrl: string, apiVersion: string): Finding[] {
  const match = endpoints.filter((e) => e.url.replace(/\/+$/, "") === webhookUrl);
  if (match.length === 0) {
    const known = endpoints.map((e) => e.url).join(", ") || "none";
    return [{ level: "fail", message: `No test-mode webhook endpoint points at ${webhookUrl}. Endpoints found: ${known}.` }];
  }
  const findings: Finding[] = [];
  for (const endpoint of match) {
    if (endpoint.livemode) findings.push({ level: "fail", message: `The endpoint for ${endpoint.url} is a live-mode endpoint.` });
    if (endpoint.status !== "enabled") findings.push({ level: "fail", message: `The endpoint for ${endpoint.url} is ${endpoint.status}. Enable it in the Stripe dashboard.` });
    const all = endpoint.enabled_events.includes("*");
    const missing = all ? [] : STRIPE_WEBHOOK_EVENTS.filter((e) => !endpoint.enabled_events.includes(e) && !(e === "refund.updated" && endpoint.enabled_events.includes("charge.refund.updated")) && !(e === "charge.refund.updated" && endpoint.enabled_events.includes("refund.updated")) && !(e === "invoice.payment_succeeded" && endpoint.enabled_events.includes("invoice.paid")));
    findings.push(missing.length ? { level: "fail", message: `The endpoint doesn't send: ${missing.join(", ")}.` } : { level: "ok", message: "The endpoint sends every event GymOS needs." });
    if (endpoint.api_version && endpoint.api_version !== apiVersion) findings.push({ level: "fail", message: `The endpoint uses API version ${endpoint.api_version}; GymOS needs ${apiVersion}. Create a new endpoint with that version.` });
    else if (!endpoint.api_version) findings.push({ level: "warn", message: `The endpoint uses the account's default API version. Check it's ${apiVersion}.` });
  }
  return findings;
}
