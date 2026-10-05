import Stripe from "stripe";
import { STRIPE_API_VERSION } from "../lib/billing/stripe";
import { checkEndpoints, checkStripeEnv, requiredEvents, siteUrl, WEBHOOK_PATH, type Finding } from "../lib/billing/stripe-check";

// npm run stripe:check [-- --remote] [-- --url https://your-site.example]
//
// Checks this environment is set up for Stripe test mode: a test-mode secret
// key, a webhook signing secret, and (with --remote) a webhook endpoint in
// Stripe that sends every event GymOS needs. Reads .env if present. Never
// prints key values (D-117).

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const urlArg = args[args.indexOf("--url") + 1];
const base = args.includes("--url") && urlArg ? urlArg.replace(/\/+$/, "") : siteUrl(process.env);
const webhookUrl = `${base}${WEBHOOK_PATH}`;

const mark = { ok: "OK  ", note: "NOTE", warn: "WARN", fail: "FAIL" } as const;
const print = (findings: Finding[]) => findings.forEach((f) => console.info(`${mark[f.level]}  ${f.message}`));

async function main() {
  console.info("Stripe test-mode check\n");
  const findings = checkStripeEnv(process.env, STRIPE_API_VERSION);
  print(findings);

  console.info(`\nWebhook endpoint URL: ${webhookUrl}`);
  console.info("It must send these events:");
  for (const line of requiredEvents()) console.info(`  - ${line}`);

  if (remote) {
    console.info("\nAsking Stripe about webhook endpoints (read-only)...");
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    if (!/^(sk|rk)_test_/.test(key)) {
      findings.push({ level: "fail", message: "Skipped: --remote only runs with a test-mode key." });
      print(findings.slice(-1));
    } else {
      try {
        const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
        const list = await stripe.webhookEndpoints.list({ limit: 100 });
        const remoteFindings = checkEndpoints(list.data, webhookUrl, STRIPE_API_VERSION);
        findings.push(...remoteFindings);
        print(remoteFindings);
      } catch (error) {
        const message = error instanceof Error ? error.message.replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, "[key]") : "unknown error";
        findings.push({ level: "fail", message: `Couldn't reach Stripe: ${message}` });
        print(findings.slice(-1));
      }
    }
  } else {
    console.info("\nAdd --remote to also check the webhook endpoint in your Stripe account.");
  }

  const failed = findings.filter((f) => f.level === "fail").length;
  console.info(failed ? `\n${failed} problem(s) to fix. See docs/STRIPE-TESTING.md.` : "\nReady for Stripe test mode. Next: docs/STRIPE-TESTING.md.");
  process.exit(failed ? 1 : 0);
}

void main();
