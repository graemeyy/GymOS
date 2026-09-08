"use client";

import React, { useState, useEffect } from "react";
import { Activity, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, Badge, Button, EmptyState } from "@/components/ui";

interface Equipment {
  id: string;
  name: string;
  status: "OPERATIONAL" | "WARNING" | "OFFLINE";
  healthScore: number;
  lastServicedAt: string | null;
  partNeeded: string | null;
  estimatedCost: number | null;
}

function statusLabel(status: Equipment["status"]) {
  if (status === "OPERATIONAL") return "Operational";
  if (status === "WARNING") return "Warning";
  return "Offline";
}

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchEquipment = async () => {
    try {
      const res = await fetch("/api/equipment");
      if (res.ok) setEquipment(await res.json());
    } catch (err) {
      console.error("Failed to fetch equipment:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
  }, []);

  const authorizeRepair = async (id: string) => {
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/equipment/${id}/po`, { method: "POST" });
      if (res.ok) await fetchEquipment();
    } catch (err) {
      console.error("Failed to authorize repair:", err);
    } finally {
      setSubmittingId(null);
    }
  };

  const priorityQueue = equipment.filter((e) => e.status !== "OPERATIONAL");

  return (
    <AppShell>
      <PageHeader title="Equipment" description="Inventory health and open maintenance." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <h2 className="font-display text-lg font-medium text-ink p-6 pb-0">Inventory</h2>
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-ink-soft" />
            </div>
          ) : equipment.length === 0 ? (
            <div className="p-6">
              <EmptyState>No equipment registered yet.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line mt-4">
              {equipment.map((eq) => (
                <li key={eq.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-surface-muted flex items-center justify-center text-ink-soft">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="font-medium text-ink">{eq.name}</p>
                      <p className="text-xs text-ink-soft">
                        Serviced {eq.lastServicedAt ? new Date(eq.lastServicedAt).toLocaleDateString() : "never"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-ink-soft hidden sm:block">{Math.round(eq.healthScore * 100)}% health</span>
                    <Badge variant={eq.status === "OPERATIONAL" ? "good" : eq.status === "WARNING" ? "warn" : "bad"}>
                      {statusLabel(eq.status)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-medium text-ink mb-4">Maintenance queue</h2>
          {priorityQueue.length === 0 ? (
            <EmptyState>Nothing needs attention.</EmptyState>
          ) : (
            <div className="space-y-3">
              {priorityQueue.map((eq) => (
                <div key={eq.id} className="rounded-xl border border-line p-4">
                  <p className="text-xs text-ink-soft mb-0.5">{statusLabel(eq.status)}</p>
                  <p className="text-sm font-medium text-ink mb-3">
                    {eq.name}
                    {eq.partNeeded ? ` — ${eq.partNeeded}` : ""}
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full !py-2 text-xs"
                    onClick={() => authorizeRepair(eq.id)}
                    disabled={eq.status !== "OFFLINE" || submittingId === eq.id}
                  >
                    {submittingId === eq.id ? "Submitting…" : eq.status === "OFFLINE" ? "Authorize repair" : "Awaiting failure"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
