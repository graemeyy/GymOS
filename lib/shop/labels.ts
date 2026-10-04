// Display labels for the shop. No imports, so client components can use it.
export const PRODUCT_CATEGORIES = ["APPAREL", "SUPPLEMENTS", "ACCESSORIES", "OTHER"] as const;
export type Category = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_TEXT: Record<Category, string> = {
  APPAREL: "Apparel",
  SUPPLEMENTS: "Supplements",
  ACCESSORIES: "Accessories",
  OTHER: "Other",
};

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PACKED", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED"] as const;
export type OrderStatusName = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_TEXT: Record<OrderStatusName, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PACKED: "Packed",
  READY_FOR_PICKUP: "Ready for pickup",
  SHIPPED: "Shipped",
  COMPLETED: "Collected",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const ORDER_STATUS_TONE: Record<OrderStatusName, "neutral" | "good" | "warn" | "bad" | "plate"> = {
  PENDING_PAYMENT: "neutral",
  PAID: "plate",
  PACKED: "warn",
  READY_FOR_PICKUP: "good",
  SHIPPED: "good",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

export function variantLabel(v: { size: string | null; colour: string | null; flavour: string | null }): string {
  return [v.size, v.colour, v.flavour].filter(Boolean).join(", ") || "Standard";
}
