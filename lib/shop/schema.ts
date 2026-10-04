import { z } from "zod";
import { zCents, zName } from "@/lib/http/route";
import { PRODUCT_CATEGORIES } from "./labels";

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

export type ProductInput = z.infer<typeof ProductBody>;

export const ProductListQuery = z.object({ category: z.enum(PRODUCT_CATEGORIES).optional(), includeArchived: z.enum(["1", "0"]).default("0") });

export type ProductListFilter = z.infer<typeof ProductListQuery>;

export const StockAdjustBody = z.object({ delta: z.number().int().min(-10_000).max(10_000).refine((d) => d !== 0, "Must not be zero"), reason: z.string().trim().max(200).optional() });

export type StockAdjustInput = z.infer<typeof StockAdjustBody>;

export const OrderListQuery = z.object({
  status: z.enum(["PENDING_PAYMENT", "PAID", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
  open: z.enum(["1", "0"]).default("0"),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export type OrderListFilter = z.infer<typeof OrderListQuery>;

export const OrderStatusBody = z.object({
  status: z.enum(["PAID", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED", "CANCELLED"]),
  note: z.string().trim().max(300).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
});

export type OrderStatusInput = z.infer<typeof OrderStatusBody>;

const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;

export const ShippingAddress = z.object({
  line1: z.string().trim().min(1, "Required").max(120),
  line2: z.string().trim().max(120).optional(),
  suburb: z.string().trim().min(1, "Required").max(60),
  state: z.enum(AU_STATES, { error: "Choose a state or territory" }),
  postcode: z.string().trim().regex(/^\d{4}$/, "Four digits"),
});

export const ShopCheckoutBody = z
  .object({
    lines: z
      .array(z.object({ variantId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(20) }))
      .min(1, "Your cart is empty")
      .max(30),
    fulfilment: z.enum(["PICKUP", "SHIPPING"]),
    shippingAddress: ShippingAddress.optional(),
  })
  .refine((b) => b.fulfilment === "PICKUP" || b.shippingAddress, { message: "Add a delivery address", path: ["shippingAddress"] });

export type ShopCheckoutInput = z.infer<typeof ShopCheckoutBody>;
