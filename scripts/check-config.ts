// Validates config/gym.config.json and prints a summary. Run before deploying
// a new gym's details: `npm run check:config`.
import { gym, formatAddress } from "../lib/config";

console.info(`Config OK: ${gym.brand.name} (ABN ${gym.business.abn})`);
console.info(`  ${formatAddress(gym)}`);
console.info(`  ${gym.plans.length} plan(s), timezone ${gym.business.timezone}${gym.isDemo ? ", DEMO DATA" : ""}`);
