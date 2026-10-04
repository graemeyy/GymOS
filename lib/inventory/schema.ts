import { z } from "zod";
import { zName, zCents } from "@/lib/http/route";

export const InventoryBody = z.object({
  name: zName,
  category: z.string().trim().max(60).nullable().optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  quantity: z.number().int().min(0).max(1_000_000).default(0),
  reorderLevel: z.number().int().min(0).max(1_000_000).default(0),
  unitCostCents: zCents.nullable().optional(),
});

export const AdjustStockBody = z.object({ delta: z.number().int().min(-10_000).max(10_000).refine((d) => d !== 0, "Must not be zero") });
