"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Plus, X, Edit2, Trash2, Download, Package, AlertTriangle, Minus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/components/SessionProvider";
import { Card, PageHeader, Button, Badge, EmptyState, StatTile } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { formatCents } from "@/lib/pricing";

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  quantity: number;
  reorderLevel: number;
  unitCostCents: number | null;
}

const EMPTY_FORM = { name: "", category: "", sku: "", quantity: "0", reorderLevel: "0", unitCost: "" };

function stockTone(item: InventoryItem): { label: string; variant: "good" | "warn" | "bad" } {
  if (item.quantity <= 0) return { label: "Out of stock", variant: "bad" };
  if (item.quantity <= item.reorderLevel) return { label: "Low stock", variant: "warn" };
  return { label: "In stock", variant: "good" };
}

export default function InventoryPage() {
  const { hasRole } = useSession();
  const canManage = hasRole("MANAGER");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/inventory");
      if (res.ok) setItems(await res.json());
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      name: formData.name,
      category: formData.category,
      sku: formData.sku,
      quantity: Number(formData.quantity),
      reorderLevel: Number(formData.reorderLevel),
      unitCostCents: formData.unitCost ? Math.round(Number(formData.unitCost) * 100) : null,
    };

    try {
      const res = await fetch(editingItem ? `/api/inventory/${editingItem.id}` : "/api/inventory", {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData(EMPTY_FORM);
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save item");
      }
    } catch {
      setError("Network error");
    }
  };

  const adjustStock = async (id: string, delta: number) => {
    setAdjustingId(id);
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      if (res.ok) {
        fetchItems();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to adjust stock");
      }
    } finally {
      setAdjustingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from inventory? This can't be undone.`)) return;
    const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    if (res.ok) fetchItems();
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || "",
      sku: item.sku || "",
      quantity: item.quantity.toString(),
      reorderLevel: item.reorderLevel.toString(),
      unitCost: item.unitCostCents != null ? (item.unitCostCents / 100).toString() : "",
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setError(null);
    setIsModalOpen(true);
  };

  const filtered = items.filter((i) => {
    const q = query.toLowerCase();
    return (
      !q ||
      i.name.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q)
    );
  });

  const lowStock = items.filter((i) => i.quantity <= i.reorderLevel);
  const stockValueCents = items.reduce((sum, i) => sum + (i.unitCostCents ?? 0) * i.quantity, 0);

  const exportCsv = () => {
    downloadCsv("inventory.csv", filtered, [
      { header: "Name", value: (i) => i.name },
      { header: "Category", value: (i) => i.category || "" },
      { header: "SKU", value: (i) => i.sku || "" },
      { header: "Quantity", value: (i) => i.quantity },
      { header: "Reorder level", value: (i) => i.reorderLevel },
      { header: "Unit cost", value: (i) => (i.unitCostCents != null ? (i.unitCostCents / 100).toFixed(2) : "") },
    ]);
  };

  return (
    <AppShell>
      <PageHeader
        title="Inventory"
        description="Stock on hand for everything you sell or use up."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            {canManage && (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4" /> Add item
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatTile icon={Package} label="Items tracked" value={loading ? "—" : items.length.toString()} />
        <StatTile
          icon={AlertTriangle}
          label="Needs restocking"
          value={loading ? "—" : lowStock.length.toString()}
          tone={lowStock.length > 0 ? "warn" : "neutral"}
        />
        <StatTile icon={Package} label="Stock value" value={loading ? "—" : formatCents(stockValueCents)} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-line">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, category, or SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-chalk border border-line rounded-xl pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
            />
            {/* Visually 32x32 so it sits inside the 38px-tall input, but the
                before: pseudo-element widens the tap target to 44x44. */}
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-ember/30 before:absolute before:-inset-1.5 before:content-['']"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="p-10 text-center text-sm text-ink-soft">Loading inventory…</p>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState>
              {query ? "No items match your search." : "Nothing tracked yet — add your first item."}
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft border-b border-line">
                <th className="font-medium px-6 py-3">Item</th>
                <th className="font-medium px-6 py-3">Status</th>
                <th className="font-medium px-6 py-3">On hand</th>
                <th className="font-medium px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((item) => {
                const tone = stockTone(item);
                return (
                  <tr key={item.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-ink-soft">
                        {[item.category, item.sku].filter(Boolean).join(" · ") || "Uncategorized"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={tone.variant}>{tone.label}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustStock(item.id, -1)}
                          disabled={adjustingId === item.id || item.quantity <= 0}
                          aria-label={`Decrease ${item.name} by one`}
                          className="p-1.5 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-8 text-center font-medium text-ink tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => adjustStock(item.id, 1)}
                          disabled={adjustingId === item.id}
                          aria-label={`Increase ${item.name} by one`}
                          className="p-1.5 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-ink-soft ml-1">reorder at {item.reorderLevel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEdit(item)}
                              aria-label={`Edit ${item.name}`}
                              className="p-2 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              aria-label={`Remove ${item.name}`}
                              className="p-2 rounded-lg text-ink-soft hover:bg-bad-soft hover:text-bad"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {isModalOpen && canManage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/30">
          <Card className="w-full max-w-md relative">
            <button
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              className="absolute right-5 top-5 p-1.5 rounded-lg text-ink-soft hover:bg-surface-muted"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="font-display text-xl font-medium text-ink mb-6">
              {editingItem ? "Edit item" : "Add item"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Item name</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  placeholder="Protein bar"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Category</label>
                  <input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                    placeholder="Snacks"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">SKU</label>
                  <input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">On hand</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Reorder at</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Unit cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                      className="w-full bg-chalk border border-line rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                    />
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-bad">{error}</p>}
              <Button type="submit" className="w-full mt-2">
                {editingItem ? "Save changes" : "Add item"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
