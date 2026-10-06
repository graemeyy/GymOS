// The demo gym's details and seeded products, read from config and the seed
// rather than written out, so no test names the demo gym (D-124).
import rawConfig from "../../config/gym.config.json";
import { PRODUCTS } from "../../prisma/seed-fixtures";

export const gym = rawConfig;
export const seededTee = PRODUCTS.find((p) => p.category === "APPAREL" && /tee/i.test(p.slug)) ?? PRODUCTS[0];
