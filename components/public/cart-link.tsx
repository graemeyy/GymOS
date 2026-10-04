"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/client/cart";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/shop/cart" className="inline-flex min-h-tap items-center gap-1.5 rounded px-3 text-sm font-medium text-ink-soft hover:bg-sunken hover:text-ink">
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Cart</span>
      {count > 0 ? <span className="tabular rounded-sm bg-plate px-1.5 text-xs font-bold text-plate-ink">{count}<span className="sr-only"> items</span></span> : null}
    </Link>
  );
}
