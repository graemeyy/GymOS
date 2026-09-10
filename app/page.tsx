"use client";

import React, { useEffect, useState } from "react";
import { DollarSign, Users, Activity, AlertTriangle, UserCheck, Wrench, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/components/SessionProvider";
import { Card, PageHeader, StatTile, Badge, LinkButton, EmptyState } from "@/components/ui";
import { formatCents } from "@/lib/pricing";

export default function DashboardPage() {
  const { session } = useSession();
  const [stats, setStats] = useState<{ revenueCents: number; activeMembers: number; checkInsToday: number; alerts: number } | null>(null);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [hideRevenue, setHideRevenue] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/check-in").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/equipment").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/settings/features").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, c, e, features]) => {
        setStats(s);
        setCheckIns(Array.isArray(c) ? c : []);
        setEquipment(Array.isArray(e) ? e : []);
        setHideRevenue(!!features?.hideRevenueFromFrontDesk);
      })
      .catch((err) => console.error("Failed to load dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  const flaggedEquipment = equipment.filter((e) => e.status !== "OPERATIONAL");
  const maskRevenue = hideRevenue && session?.role === "FRONT_DESK";

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Today's overview across members, equipment, and check-ins."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile icon={DollarSign} label="Monthly revenue" value={loading || !stats ? "—" : maskRevenue ? "•••••" : formatCents(stats.revenueCents)} />
        <StatTile icon={Users} label="Active members" value={loading || !stats ? "—" : stats.activeMembers.toLocaleString()} />
        <StatTile icon={Activity} label="Check-ins today" value={loading || !stats ? "—" : stats.checkInsToday.toLocaleString()} />
        <StatTile
          icon={AlertTriangle}
          label="Needs attention"
          value={loading || !stats ? "—" : stats.alerts.toString()}
          tone={stats && stats.alerts > 0 ? "warn" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-medium text-ink">Recent check-ins</h2>
            <LinkButton href="/members" variant="ghost" className="!px-2 !py-1 text-xs">
              View members <ArrowRight className="w-3.5 h-3.5" />
            </LinkButton>
          </div>
          {loading ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : checkIns.length === 0 ? (
            <EmptyState>No check-ins recorded yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {checkIns.slice(0, 6).map((ci: any) => (
                <li key={ci.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-ink-soft">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{ci.member?.name || ci.member?.email || "Unknown"}</p>
                      <p className="text-xs text-ink-soft">{new Date(ci.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <Badge variant={ci.member?.status === "ACTIVE" ? "good" : "neutral"}>
                    {ci.member?.status === "ACTIVE" ? "Active" : ci.member?.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-medium text-ink">Equipment status</h2>
            <LinkButton href="/equipment" variant="ghost" className="!px-2 !py-1 text-xs">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </LinkButton>
          </div>
          {loading ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : flaggedEquipment.length === 0 ? (
            <EmptyState>Everything's operational.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {flaggedEquipment.slice(0, 6).map((eq: any) => (
                <li key={eq.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-ink-soft">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{eq.name}</p>
                      {eq.partNeeded && <p className="text-xs text-ink-soft">{eq.partNeeded}</p>}
                    </div>
                  </div>
                  <Badge variant={eq.status === "OFFLINE" ? "bad" : "warn"}>
                    {eq.status === "OFFLINE" ? "Offline" : "Warning"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
