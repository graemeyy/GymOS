import rawConfig from "@/config/gym.config.json";
import { formatAddress as formatAddressOf } from "./address";
import type { GymConfig } from "./schema";

// The gym config for browser code, without bundling Zod and the schema into
// every page (R-62). It's the same file the server validates at build and
// start-up (lib/config/index.ts); the schema has no defaults or transforms,
// so the raw file and the parsed config match, which client.test.ts checks.
export const gym = rawConfig as GymConfig;

export const formatAddress = (cfg: GymConfig = gym) => formatAddressOf(cfg);

export type { GymConfig, PlanBenefits } from "./schema";
