import { z } from "zod";
import { zCents, zName } from "@/lib/http/route";
import { PRODUCT_CATEGORIES } from "./labels";

export { PRODUCT_CATEGORIES, CATEGORY_TEXT } from "./labels";

export const VariantBody = z.object({
  id: z.string().optional(),
  size: z.string().trim().max(20).nullable().optional(),
  colour: z.string().trim().max(30).nullable().optional(),
  flavour: z.string().trim().max(40).nullable().optional(),
  sku: z.string().trim().min(1, "Required").max(64),
  priceCents: zCents.refine((c) => c > 0, "Set a price"),
  stockQty: z.number().int().min(0).max(100_000).default(0),
  active: z.boolean().default(true),
});

export const ProductBody = z.object({
  name: zName,
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.enum(PRODUCT_CATEGORIES),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u.startsWith("/") || u.startsWith("https://"), "Use an https:// address or a path on this site")
    .nullable()
    .optional(),
  active: z.boolean().default(true),
  variants: z.array(VariantBody).min(1, "Add at least one variant").max(60),
});

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// Phrases the app warns about in supplement descriptions. It doesn't block
// them: claims can be legitimate with the right approvals, and the owner is
// responsible. The note points to TGA and Food Standards rules.
const CLAIM_WORDS = ["cure", "treat", "prevent", "heal", "boost immunity", "burn fat", "fat burner", "detox", "testosterone", "clinically proven", "guaranteed results", "medical", "therapeutic", "weight loss"];

export function claimWarnings(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return CLAIM_WORDS.filter((w) => lower.includes(w));
}
