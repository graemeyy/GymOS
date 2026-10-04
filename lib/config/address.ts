import type { GymConfig } from "./schema";

export function formatAddress(cfg: GymConfig): string {
  const a = cfg.business.address;
  return [a.line1, a.line2, `${a.suburb} ${a.state} ${a.postcode}`].filter(Boolean).join(", ");
}
