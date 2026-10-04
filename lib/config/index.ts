import rawConfig from "@/config/gym.config.json";
import { gymConfigSchema, type GymConfig } from "./schema";
import { formatAddress as formatAddressOf } from "./address";

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

export const formatAddress = (cfg: GymConfig = gym) => formatAddressOf(cfg);

export * from "./schema";
