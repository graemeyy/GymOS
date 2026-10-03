import rawConfig from "@/config/gym.config.json";
import { gymConfigSchema, type GymConfig } from "./schema";

export function parseGymConfig(input: unknown): GymConfig {
  const result = gymConfigSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`config/gym.config.json is invalid:\n${issues}`);
  }
  return result.data;
}

// Parsed once at module load, so a bad config fails the build and the server
// start rather than a random request later.
export const gym: GymConfig = parseGymConfig(rawConfig);

export function formatAddress(cfg: GymConfig = gym): string {
  const a = cfg.business.address;
  return [a.line1, a.line2, `${a.suburb} ${a.state} ${a.postcode}`].filter(Boolean).join(", ");
}

export * from "./schema";
