"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { parseDollarsToCents } from "@/lib/money";
import { CATEGORY_TEXT, PRODUCT_CATEGORIES, type Category } from "@/lib/shop/labels";
import { AdminOnlyNote, Button, IconButton, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { useStaff } from "@/components/admin/staff-session";
import { ErrorState, LoadingRows, useToast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField, TextareaField } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { LocationField, useLocationFilter } from "@/components/admin/location-filter";

interface VariantForm {
  key: string;
  id?: string;
  size: string;
  colour: string;
  flavour: string;
  sku: string;
  price: string;
  stockQty: string;
  active: boolean;
}
interface ProductData {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  imageUrl: string | null;
  active: boolean;
  claimWarnings: string[];
  variants: { id: string; size: string | null; colour: string | null; flavour: string | null; sku: string; priceCents: number; stockQty: number; active: boolean }[];
}

let keySeq = 0;
const newVariant = (): VariantForm => ({ key: `n${keySeq++}`, size: "", colour: "", flavour: "", sku: "", price: "", stockQty: "0", active: true });

function SupplementNote({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded border border-warn bg-warn-tint px-4 py-3 text-sm text-ink">
      <p className="font-medium">Before you list a supplement</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>Describe what it is (ingredients, size, flavour, serves). Don&apos;t claim it treats, prevents or cures anything, or improves health or performance.</li>
        <li>Some supplements are regulated by the TGA, and food-type supplements must meet the Food Standards Code. What you can sell and say depends on the product. Get your own advice.</li>
        <li>Keep the manufacturer&apos;s label, allergens and warnings available to buyers.</li>
      </ul>
      {warnings.length > 0 ? <p className="mt-2 font-medium text-bad">Check these words in the description: {warnings.join(", ")}.</p> : null}
    </div>
  );
}

export default function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const toast = useToast();
  // Prices, and new variants (which set a price), need prices.edit; without it
  // they're shown read-only.
  const canPrice = useStaff().can("prices.edit");
  const filter = useLocationFilter();
  // Opening stock for new variants goes to one location (D-127).
  const [stockLocation, setStockLocation] = useState("");
  const stockLocationId = stockLocation || filter.current || "";
  const existing = useResource<ProductData>(isNew || !filter.ready ? null : `/api/products/${id}${stockLocationId ? `?locationId=${encodeURIComponent(stockLocationId)}` : ""}`);
  const [form, setForm] = useState({ name: "", description: "", category: "APPAREL" as Category, imageUrl: "", active: true });
  const [variants, setVariants] = useState<VariantForm[]>([newVariant()]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  // Stays busy after archiving while the page moves to the shop.
  const [archived, setArchived] = useState(false);

  const save = useMutation((body: Record<string, unknown>) => api<ProductData>(isNew ? "/api/products" : `/api/products/${id}`, { method: isNew ? "POST" : "PUT", body }), {
    onSuccess: (saved) => {
      setWarnings(saved.claimWarnings);
      toast(isNew ? "Product added" : "Product saved");
      if (isNew) router.replace(`/admin/shop/products/${saved.id}`);
      else void existing.reload();
    },
    onError: (e) => {
      setErrors(e.fields);
      setMessage(e.message);
    },
  });

  const archive = useMutation(() => api(`/api/products/${id}`, { method: "DELETE" }), {
    onSuccess: () => {
      setArchived(true);
      toast("Product archived");
      router.push("/admin/shop");
    },
    onError: (e) => toast(e.message, "bad"),
  });

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setForm({ name: p.name, description: p.description ?? "", category: p.category, imageUrl: p.imageUrl ?? "", active: p.active });
    setVariants(p.variants.map((v) => ({ key: v.id, id: v.id, size: v.size ?? "", colour: v.colour ?? "", flavour: v.flavour ?? "", sku: v.sku, price: (v.priceCents / 100).toFixed(2), stockQty: String(v.stockQty), active: v.active })));
    setWarnings(p.claimWarnings);
  }, [existing.data]);

  const setVariant = (key: string, patch: Partial<VariantForm>) => setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const priced = variants.map((v) => ({ v, cents: parseDollarsToCents(v.price) }));
    const bad = priced.find((x) => !x.cents);
    if (bad) return setErrors({ [`price-${bad.v.key}`]: "Enter a price like 35.00" });
    setErrors({});
    setMessage(null);
    const body = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      imageUrl: form.imageUrl || null,
      active: form.active,
      ...(stockLocationId ? { stockLocationId } : {}),
      variants: priced.map(({ v, cents }) => ({ id: v.id, size: v.size || null, colour: v.colour || null, flavour: v.flavour || null, sku: v.sku, priceCents: cents, stockQty: Number(v.stockQty) || 0, active: v.active })),
    };
    void save.run(body);
  };

  if (!isNew && existing.error) return <ErrorState message={existing.error.message} onRetry={existing.reload} />;
  if (!isNew && !existing.data) return <LoadingRows label="Loading product" />;

  return (
    <>
      <Link href="/admin/shop" className="mb-4 inline-flex min-h-tap items-center gap-2 rounded text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Shop products
      </Link>
      <PageHeader
        title={isNew ? "Add a product" : form.name || "Product"}
        actions={
          !isNew ? (
            <Button variant="danger" onClick={() => setArchiveOpen(true)}>
              Archive
            </Button>
          ) : undefined
        }
      />
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Panel aria-labelledby="details-heading">
          <PanelHeader id="details-heading" title="Details" />
          <div className="space-y-4 p-4">
            <TextField label="Name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <SelectField label="Category" value={form.category} error={errors.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_TEXT[c]}
                </option>
              ))}
            </SelectField>
            {form.category === "SUPPLEMENTS" ? <SupplementNote warnings={warnings} /> : null}
            <TextareaField label="Description" rows={4} value={form.description} error={errors.description} hint="Plain facts: what it is, materials or ingredients, sizing." onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <TextField label="Photo address (optional)" value={form.imageUrl} error={errors.imageUrl} hint="An https:// link to the product photo." onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <Switch label="Show in the shop" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          </div>
        </Panel>

        <Panel aria-labelledby="variants-heading">
          <PanelHeader
            id="variants-heading"
            title="Variants"
            action={
              <Button variant="secondary" disabled={!canPrice} onClick={() => setVariants((vs) => [...vs, newVariant()])}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Add variant
              </Button>
            }
          />
          <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">One row for each size, colour or flavour you stock. Leave fields blank if they don&apos;t apply. Prices include GST.</p>
          {filter.multiple ? (
            <div className="border-b border-line px-4 py-3 sm:max-w-sm">
              <LocationField label="Stock shown for" hint="Stock for new variants goes here. Adjust existing stock on the products list." value={stockLocationId} onChange={setStockLocation} />
            </div>
          ) : null}
          {canPrice ? null : <AdminOnlyNote id="price-note" className="border-b border-line px-4 py-3" />}
          {errors.variants ? <p className="px-4 pt-3 text-sm font-medium text-bad">{errors.variants}</p> : null}
          <ul className="divide-y divide-line">
            {variants.map((v, i) => (
              <li key={v.key} className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Variant {i + 1}</p>
                  {variants.length > 1 ? (
                    <IconButton label={`Remove variant ${i + 1}`} onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <TextField label="Size" value={v.size} onChange={(e) => setVariant(v.key, { size: e.target.value })} />
                  <TextField label="Colour" value={v.colour} onChange={(e) => setVariant(v.key, { colour: e.target.value })} />
                  <TextField label="Flavour" value={v.flavour} onChange={(e) => setVariant(v.key, { flavour: e.target.value })} />
                  <TextField label="SKU" required value={v.sku} error={errors[`variants.${i}.sku`]} onChange={(e) => setVariant(v.key, { sku: e.target.value })} />
                  <TextField label="Price (AUD)" inputMode="decimal" readOnly={!canPrice} aria-describedby={canPrice ? undefined : "price-note"} value={v.price} error={errors[`price-${v.key}`] ?? errors[`variants.${i}.priceCents`]} onChange={(e) => setVariant(v.key, { price: e.target.value })} />
                  <TextField label={v.id ? "In stock" : "Opening stock"} type="number" inputMode="numeric" min={0} readOnly={Boolean(v.id)} value={v.stockQty} onChange={(e) => setVariant(v.key, { stockQty: e.target.value })} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <div className="flex gap-2">
          <Button type="submit" busy={save.busy}>
            {isNew ? "Add product" : "Save product"}
          </Button>
        </div>
      </form>
      <ConfirmDialog open={archiveOpen} onCancel={() => setArchiveOpen(false)} onConfirm={() => void archive.run()} busy={archive.busy || archived} title={`Archive ${form.name}?`} confirmLabel="Archive product" body="It disappears from the shop. Past orders keep it." />
    </>
  );
}
