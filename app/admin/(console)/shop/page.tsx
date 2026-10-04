"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { CATEGORY_TEXT, PRODUCT_CATEGORIES, variantLabel, type Category } from "@/lib/shop/labels";
import { useStaff } from "@/components/admin/staff-session";
import { IconButton, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/form";
import { LOW_STOCK_AT } from "@/lib/shop/limits";

interface Variant {
  id: string;
  size: string | null;
  colour: string | null;
  flavour: string | null;
  sku: string;
  priceCents: number;
  stockQty: number;
  active: boolean;
}
interface Product {
  id: string;
  name: string;
  category: Category;
  active: boolean;
  variants: Variant[];
}

export default function ShopProductsPage() {
  const { can } = useStaff();
  const [category, setCategory] = useState("");
  const [archived, setArchived] = useState(false);
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (archived) params.set("includeArchived", "1");
  const products = useResource<Product[]>(`/api/products?${params.toString()}`);

  return (
    <>
      <PageHeader
        title="Shop products"
        description="Apparel, supplements and gear sold in the app and at the desk. Prices include GST."
        actions={
          <>
            <LinkButton href="/admin/shop/orders" variant="secondary">
              Orders
            </LinkButton>
            {can("products.edit") && can("prices.edit") ? <LinkButton href="/admin/shop/products/new">Add product</LinkButton> : null}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} wrapperClassName="sm:w-60">
          <option value="">All categories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_TEXT[c]}
            </option>
          ))}
        </SelectField>
        <label className="flex min-h-tap items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-plate" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <AsyncBlock loading={products.loading} error={products.error} data={products.data} onRetry={products.reload} loadingLabel="Loading products">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No products yet" action={can("products.edit") && can("prices.edit") ? <LinkButton href="/admin/shop/products/new">Add the first product</LinkButton> : undefined} />
          ) : (
            <div className="space-y-4">
              {rows.map((p) => (
                <Panel key={p.id} aria-labelledby={`p-${p.id}`}>
                  <PanelHeader
                    id={`p-${p.id}`}
                    title={p.name}
                    action={
                      <span className="flex items-center gap-2">
                        <StatusTag>{CATEGORY_TEXT[p.category]}</StatusTag>
                        {!p.active ? <StatusTag tone="warn">Archived</StatusTag> : null}
                        {can("products.edit") ? (
                          <Link href={`/admin/shop/products/${p.id}`} className="rounded px-2 py-1 text-sm font-medium text-plate underline-offset-2 hover:underline">
                            Edit<span className="sr-only"> {p.name}</span>
                          </Link>
                        ) : null}
                      </span>
                    }
                  />
                  <ul className="divide-y divide-line">
                    {p.variants
                      .filter((v) => v.active || archived)
                      .map((v) => (
                        <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                          <span className="min-w-0">
                            <span className="font-medium">{variantLabel(v)}</span> <span className="text-sm text-ink-soft">{v.sku}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="tabular">{formatAud(v.priceCents)}</span>
                            {v.stockQty === 0 ? <StatusTag tone="bad">Sold out</StatusTag> : v.stockQty <= LOW_STOCK_AT ? <StatusTag tone="warn">{v.stockQty} left</StatusTag> : <span className="tabular w-14 text-right text-sm text-ink-soft">{v.stockQty} in stock</span>}
                            {can("orders.manage") ? (
                              <StockButtons label={`${p.name} ${variantLabel(v)}`} variant={v} onAdjusted={products.reload} />
                            ) : null}
                          </span>
                        </li>
                      ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )
        }
      </AsyncBlock>
    </>
  );
}

// Each variant owns its own request, so adjusting one never blocks another.
function StockButtons({ label, variant, onAdjusted }: { label: string; variant: Variant; onAdjusted: () => Promise<void> }) {
  const toast = useToast();
  const adjust = useMutation((delta: number) => api(`/api/product-variants/${variant.id}`, { method: "PATCH", body: { delta } }), {
    onSuccess: () => void onAdjusted(),
    onError: (e) => toast(e.message, "bad"),
  });
  return (
    <span className="flex">
      <IconButton label={`One less ${label}`} disabled={variant.stockQty === 0 || adjust.busy} onClick={() => void adjust.run(-1)}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </IconButton>
      <IconButton label={`One more ${label}`} disabled={adjust.busy} onClick={() => void adjust.run(1)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </span>
  );
}
