import "server-only";
import { z } from "zod";

const optionalSecret = (min: number, label: string) =>
  z
    .string()
    .min(min, `${label} must be at least ${min} characters`)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a postgres:// URL"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters (use `openssl rand -base64 48`)"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^(sk|rk)_(test|live)_/, "STRIPE_SECRET_KEY must start with sk_test_ or rk_test_ (live keys, sk_live_ or rk_live_, also need STRIPE_ALLOW_LIVE_KEYS=true)")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with whsec_")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    // Live keys are refused unless this is explicitly "true". Development and
    // review use Stripe test mode only.
    STRIPE_ALLOW_LIVE_KEYS: z.enum(["true", "false"]).default("false"),
    CRON_SECRET: optionalSecret(16, "CRON_SECRET"),
    IOT_GATEWAY_SECRET: optionalSecret(16, "IOT_GATEWAY_SECRET"),
    // Needed to create the first owner account on a production deployment,
    // so whoever reaches a new site first can't take it over (R-42).
    SETUP_TOKEN: optionalSecret(16, "SETUP_TOKEN"),
    RESEND_API_KEY: z.string().optional().or(z.literal("").transform(() => undefined)),
    EMAIL_FROM: z.string().optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((env, ctx) => {
    const live = env.STRIPE_SECRET_KEY && /_live_/.test(env.STRIPE_SECRET_KEY);
    if (live && env.STRIPE_ALLOW_LIVE_KEYS !== "true") {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message: "A live Stripe key was supplied. GymOS refuses live keys unless STRIPE_ALLOW_LIVE_KEYS=true.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Names only, never values: this message can end up in logs.
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | null = null;

// Read lazily so `next build` (which imports route modules) doesn't need
// production secrets; instrumentation.ts calls this once at server start.
export function env(): ServerEnv {
  if (!cached) cached = parseServerEnv(process.env);
  return cached;
}

export function resetEnvCacheForTests() {
  cached = null;
}
