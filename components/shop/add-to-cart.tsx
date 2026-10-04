"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/client/cart";
import { cn } from "@/lib/client/cn";
import type { CatalogueProduct } from "@/lib/shop/catalogue";
import { Button } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { Price } from "./price";

export function AddToCart({ product, discountPercent }: { product: CatalogueProduct; discountPercent: number }) {
  const firstAvailable = product.variants.find((v) => v.available) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable.id);
  const [quantity, setQuantity] = useState(1);
  const { add, lines } = useCart();
  const toast = useToast();
  const variant = product.variants.find((v) => v.id === variantId)!;
  const inCart = lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
  const canAdd = variant.available && inCart + quantity <= variant.maxQuantity;

  return (
    <div className="h-fit space-y-5 rounded-lg border border-line bg-surface p-5">
      <Price cents={variant.priceCents} discountPercent={discountPercent} />
      {product.variants.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Option</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <label
                key={v.id}
                className={cn(
                  "inline-flex min-h-tap cursor-pointer items-center rounded border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-plate",
                  v.id === variantId ? "border-plate bg-plate-tint font-medium text-ink" : "border-line-strong",
                  !v.available && "text-ink-soft line-through"
                )}
              >
                <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => { setVariantId(v.id); setQuantity(1); }} className="sr-only" />
                {v.label}
                {!v.available ? <span className="sr-only"> (sold out)</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {variant.available ? (
        <>
          <SelectField label="Quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
            {Array.from({ length: Math.max(1, variant.maxQuantity - inCart) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectField>
          {variant.lowStock ? <p className="text-sm font-medium text-warn">Only a few left.</p> : null}
          <Button
            className="w-full"
            disabled={!canAdd}
            onClick={() => {
              add(variantId, quantity);
              toast(`Added to cart: ${product.name} (${variant.label}).`);
            }}
          >
            Add to cart
          </Button>
          {inCart > 0 ? (
            <p className="text-sm text-ink-soft">
              {inCart} in your cart.{" "}
              <Link href="/shop/cart" className="font-medium text-plate underline underline-offset-2">
                View cart
              </Link>
            </p>
          ) : null}
        </>
      ) : (
        <p className="font-medium text-bad">Sold out</p>
      )}
    </div>
  );
}
