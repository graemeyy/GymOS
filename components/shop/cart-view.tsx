"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { useCart } from "@/lib/client/cart";
import { formatAud } from "@/lib/money";
import { gym } from "@/lib/config/client";
import { priceOrder } from "@/lib/shop/pricing";
import type { Catalogue } from "@/lib/shop/catalogue";
import { cn } from "@/lib/client/cn";
import { Button, IconButton, LinkButton, PageHeader } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";

const STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];

export function CartView() {
  const catalogue = useResource<Catalogue>("/api/shop/products");
  const { lines, setQuantity } = useCart();
  const [fulfilment, setFulfilment] = useState<"PICKUP" | "SHIPPING">("PICKUP");
  const [address, setAddress] = useState<{ line1: string; line2: string; suburb: string; state: string; postcode: string }>({ line1: "", line2: "", suburb: "", state: gym.business.address.state, postcode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    if (!catalogue.data) return [];
    const byVariant = new Map(catalogue.data.products.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)));
    return lines.map((l) => ({ line: l, item: byVariant.get(l.variantId) ?? null }));
  }, [catalogue.data, lines]);

  const priceable = rows.filter((r) => r.item?.variant.available);
  const estimate = catalogue.data && priceable.length ? priceOrder(priceable.map((r) => ({ variantId: r.line.variantId, quantity: r.line.quantity, unitPriceCents: r.item!.variant.priceCents })), catalogue.data.discountPercent, fulfilment) : null;
  const unavailable = rows.filter((r) => !r.item || !r.item.variant.available || r.line.quantity > r.item.variant.maxQuantity);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const { url } = await api<{ url: string }>("/api/shop/checkout", {
        body: {
          lines: priceable.map((r) => r.line),
          fulfilment,
          shippingAddress: fulfilment === "SHIPPING" ? { ...address, line2: address.line2 || undefined } : undefined,
        },
      });
      window.location.assign(url);
    } catch (e) {
      if (e instanceof ApiClientError) {
        setFields(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k.replace("shippingAddress.", ""), v])));
        setError(e.message);
      } else setError("Couldn't start the payment. Try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Cart" />
      <AsyncBlock loading={catalogue.loading} error={catalogue.error} data={catalogue.data} onRetry={catalogue.reload} loadingLabel="Loading your cart">
        {(data) =>
          lines.length === 0 ? (
            <EmptyState title="Your cart is empty" action={<LinkButton href="/shop">Browse the shop</LinkButton>} />
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_22rem]">
              <ul className="divide-y divide-line self-start rounded-lg border border-line bg-surface">
                {rows.map(({ line, item }) => (
                  <li key={line.variantId} className="flex items-start justify-between gap-3 px-4 py-4">
                    <div className="min-w-0">
                      {item ? (
                        <Link href={`/shop/${item.product.slug}`} className="font-medium underline-offset-2 hover:underline">
                          {item.product.name}
                        </Link>
                      ) : (
                        <span className="font-medium">No longer sold</span>
                      )}
                      {item ? <p className="text-sm text-ink-soft">{item.variant.label}</p> : null}
                      {item && !item.variant.available ? <p className="text-sm font-medium text-bad">Sold out. Remove it to check out.</p> : null}
                      {item?.variant.available && line.quantity > item.variant.maxQuantity ? <p className="text-sm font-medium text-bad">Only {item.variant.maxQuantity} available.</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item?.variant.available ? (
                        <label className="sr-only" htmlFor={`qty-${line.variantId}`}>
                          Quantity of {item.product.name}
                        </label>
                      ) : null}
                      {item?.variant.available ? (
                        <select
                          id={`qty-${line.variantId}`}
                          value={line.quantity}
                          onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                          className="min-h-tap rounded border border-line-strong bg-surface px-2"
                        >
                          {Array.from({ length: item.variant.maxQuantity }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                          {/* Show the real quantity when stock has dropped below it, so
                              picking an available number is a change the cart sees (R-49). */}
                          {line.quantity > item.variant.maxQuantity ? (
                            <option value={line.quantity} disabled>
                              {line.quantity} (too many)
                            </option>
                          ) : null}
                        </select>
                      ) : null}
                      <IconButton label={`Remove ${item?.product.name ?? "item"}`} onClick={() => setQuantity(line.variantId, 0)}>
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="h-fit space-y-5 rounded-lg border border-line bg-surface p-5">
                {!data.shipping.pickupOnly ? (
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">How would you like it?</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(["PICKUP", "SHIPPING"] as const).map((f) => (
                        <label key={f} className={cn("flex min-h-tap cursor-pointer items-center justify-center rounded border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-plate", fulfilment === f ? "border-plate bg-plate-tint font-medium" : "border-line-strong")}>
                          <input type="radio" name="fulfilment" value={f} checked={fulfilment === f} onChange={() => setFulfilment(f)} className="sr-only" />
                          {f === "PICKUP" ? "Pick up at the gym" : "Deliver"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <p className="text-sm">Collect from the front desk at {gym.business.address.line1}, {gym.business.address.suburb}.</p>
                )}
                {fulfilment === "SHIPPING" ? (
                  <div className="space-y-3">
                    <TextField label="Street address" autoComplete="address-line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} error={fields.line1} />
                    <TextField label="Unit or building (optional)" autoComplete="address-line2" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
                    <TextField label="Suburb" autoComplete="address-level2" value={address.suburb} onChange={(e) => setAddress({ ...address, suburb: e.target.value })} error={fields.suburb} />
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField label="State" autoComplete="address-level1" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} error={fields.state}>
                        {STATES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </SelectField>
                      <TextField label="Postcode" inputMode="numeric" autoComplete="postal-code" maxLength={4} value={address.postcode} onChange={(e) => setAddress({ ...address, postcode: e.target.value })} error={fields.postcode} />
                    </div>
                  </div>
                ) : null}

                {estimate ? (
                  <dl className="space-y-1 border-t border-line pt-4 text-sm">
                    <div className="flex justify-between text-ink-soft">
                      <dt>Items</dt>
                      <dd className="tabular">{formatAud(estimate.subtotalCents)}</dd>
                    </div>
                    {estimate.discountCents > 0 ? (
                      <div className="flex justify-between text-ink-soft">
                        <dt>Member discount ({data.discountPercent}%)</dt>
                        <dd className="tabular">-{formatAud(estimate.discountCents)}</dd>
                      </div>
                    ) : null}
                    {fulfilment === "SHIPPING" ? (
                      <div className="flex justify-between text-ink-soft">
                        <dt>Shipping</dt>
                        <dd className="tabular">{estimate.shippingCents ? formatAud(estimate.shippingCents) : "Free"}</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-base font-bold">
                      <dt>Total</dt>
                      <dd className="tabular">{formatAud(estimate.totalCents)}</dd>
                    </div>
                    {gym.business.gstRegistered ? (
                      <div className="flex justify-between text-ink-soft">
                        <dt>Includes GST</dt>
                        <dd className="tabular">{formatAud(estimate.gstCents)}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                {error ? <FormMessage>{error}</FormMessage> : null}
                {data.signedIn ? (
                  <Button className="w-full" onClick={checkout} busy={busy} disabled={!estimate || unavailable.length > 0}>
                    Pay {estimate ? formatAud(estimate.totalCents) : ""}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <LinkButton href="/login?next=/shop/cart" className="w-full">
                      Sign in to pay
                    </LinkButton>
                    <p className="text-sm text-ink-soft">
                      The shop is for members. <Link href="/signup" className="font-medium text-plate underline underline-offset-2">Join online</Link> if you&apos;re new.
                    </p>
                  </div>
                )}
                <p className="text-xs text-ink-soft">
                  Card payments are handled by Stripe.{" "}
                  {data.changeOfMindReturnsDays > 0 ? `Change-of-mind returns within ${data.changeOfMindReturnsDays} days. ` : "No change-of-mind returns. "}
                  Faulty items are always covered by the Australian Consumer Law.
                </p>
              </div>
            </div>
          )
        }
      </AsyncBlock>
    </div>
  );
}
