"use client";

import React, { useState } from "react";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { formatAud, parseDollarsToCents } from "@/lib/money";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SearchField, TextField } from "@/components/ui/form";
import { DataList } from "@/components/ui/data-list";

interface Item {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  quantity: number;
  reorderLevel: number;
  unitCostCents: number | null;
}

const empty = { name: "", category: "", sku: "", quantity: "0", reorderLevel: "0", unitCost: "" };

export default function StockPage() {
  const { can } = useStaff();
  const toast = useToast();
  const items = useResource<Item[]>("/api/inventory");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openForm = (item: Item | null) => {
    setEditing(item);
    setErrors({});
    setMessage(null);
    setForm(
      item
        ? { name: item.name, category: item.category ?? "", sku: item.sku ?? "", quantity: String(item.quantity), reorderLevel: String(item.reorderLevel), unitCost: item.unitCostCents != null ? (item.unitCostCents / 100).toFixed(2) : "" }
        : empty
    );
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const unitCostCents = form.unitCost.trim() ? parseDollarsToCents(form.unitCost) : null;
    if (form.unitCost.trim() && unitCostCents === null) return setErrors({ unitCostCents: "Enter an amount like 12.50" });
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const body = { name: form.name, category: form.category || null, sku: form.sku || null, quantity: Number(form.quantity) || 0, reorderLevel: Number(form.reorderLevel) || 0, unitCostCents };
      await api(editing ? `/api/inventory/${editing.id}` : "/api/inventory", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Item updated" : "Item added");
      setOpen(false);
      void items.reload();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fields);
        setMessage(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const adjust = async (item: Item, delta: number) => {
    try {
      await api(`/api/inventory/${item.id}`, { method: "PATCH", body: { delta } });
      void items.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't change the stock.", "bad");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/inventory/${deleting.id}`, { method: "DELETE" });
      toast("Item removed");
      void items.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't remove the item.", "bad");
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  };

  const rows = (items.data ?? []).filter((i) => !q || `${i.name} ${i.sku ?? ""} ${i.category ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Stock"
        description="Back-of-house supplies such as chalk, cleaning products and towels."
        actions={
          can("inventory:manage") ? (
            <Button onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add item
            </Button>
          ) : undefined
        }
      />
      <Panel>
        <div className="border-b border-line p-4">
          <SearchField label="Search stock" placeholder="Search by name, SKU or category" value={q} onChange={setQ} className="max-w-md" />
        </div>
        <AsyncBlock loading={items.loading} error={items.error} data={items.data} onRetry={items.reload}>
          {() =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title={q ? "Nothing matches" : "No stock items yet"} />
              </div>
            ) : (
              <DataList
                caption="Stock"
                rows={rows}
                rowKey={(i) => i.id}
                columns={[
                  {
                    header: "Item",
                    primary: true,
                    cell: (i) => (
                      <div>
                        <p className="font-medium">{i.name}</p>
                        <p className="text-sm text-ink-soft">{[i.category, i.sku].filter(Boolean).join(", ") || "No category"}</p>
                      </div>
                    ),
                  },
                  {
                    header: "On hand",
                    cell: (i) => (
                      <span className="flex items-center gap-2">
                        <span className="tabular font-medium">{i.quantity}</span>
                        {i.quantity <= i.reorderLevel ? <StatusTag tone="warn">Reorder</StatusTag> : null}
                      </span>
                    ),
                  },
                  { header: "Reorder at", cell: (i) => <span className="tabular">{i.reorderLevel}</span> },
                  { header: "Unit cost", cell: (i) => (i.unitCostCents != null ? formatAud(i.unitCostCents) : <span className="text-ink-soft">Not set</span>) },
                ]}
                actions={(i) => (
                  <>
                    {can("inventory:adjust") ? (
                      <>
                        <IconButton label={`Use one ${i.name}`} disabled={i.quantity === 0} onClick={() => adjust(i, -1)}>
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton label={`Add one ${i.name}`} onClick={() => adjust(i, 1)}>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </>
                    ) : null}
                    {can("inventory:manage") ? (
                      <>
                        <IconButton label={`Edit ${i.name}`} onClick={() => openForm(i)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton label={`Remove ${i.name}`} onClick={() => setDeleting(i)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </>
                    ) : null}
                  </>
                )}
              />
            )
          }
        </AsyncBlock>
      </Panel>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit item" : "Add item"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="stock-form" busy={busy}>
              {editing ? "Save changes" : "Add item"}
            </Button>
          </>
        }
      >
        <form id="stock-form" onSubmit={submit} className="space-y-4" noValidate>
          <TextField label="Item name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Category" value={form.category} error={errors.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <TextField label="SKU" value={form.sku} error={errors.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <TextField label="On hand" type="number" inputMode="numeric" min={0} value={form.quantity} error={errors.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <TextField label="Reorder at" type="number" inputMode="numeric" min={0} value={form.reorderLevel} error={errors.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          </div>
          <TextField label="Unit cost (AUD, incl. GST)" inputMode="decimal" value={form.unitCost} error={errors.unitCostCents} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          {message ? <FormMessage>{message}</FormMessage> : null}
        </form>
      </Dialog>
      <ConfirmDialog open={Boolean(deleting)} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} busy={deleteBusy} title={`Remove ${deleting?.name ?? "item"}?`} confirmLabel="Remove item" body="This deletes the stock record. It can't be undone." />
    </>
  );
}
