"use client";

import React, { useState, useEffect } from "react";
import { Mail, ShieldAlert, Clock, TrendingDown, DollarSign } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, StatTile, Badge, EmptyState } from "@/components/ui";
import { PLAN_PRICES, formatCents } from "@/lib/pricing";

interface Member {
  id: string;
  name: string | null;
  email: string;
  status: string;
  plan: keyof typeof PLAN_PRICES;
  retentionScore: number;
  lastCheckIn: string | null;
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export default function RetentionPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [planPrices, setPlanPrices] = useState<Record<string, number>>(PLAN_PRICES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/members").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/settings/plan-prices").then((res) => (res.ok ? res.json() : PLAN_PRICES)),
    ])
      .then(([memberData, prices]) => {
        setMembers(Array.isArray(memberData) ? memberData : []);
        setPlanPrices(prices);
      })
      .catch((err) => console.error("Failed to fetch retention data:", err))
      .finally(() => setLoading(false));
  }, []);

  const active = members.filter((m) => m.status === "ACTIVE");
  const highRisk = active.filter((m) => m.retentionScore < 40);
  const ghosting = active.filter((m) => (daysSince(m.lastCheckIn) ?? Infinity) >= 14);
  const avgChurnProbability = active.length
    ? Math.round(active.reduce((sum, m) => sum + (100 - m.retentionScore), 0) / active.length)
    : 0;
  const mrrAtRiskCents = highRisk.reduce((sum, m) => sum + (planPrices[m.plan] ?? 0), 0);

  const priorityList = [...active].sort((a, b) => a.retentionScore - b.retentionScore).slice(0, 8);

  return (
    <AppShell>
      <PageHeader title="Retention" description="Members most likely to cancel, ranked by risk." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile icon={ShieldAlert} label="High risk" value={loading ? "—" : highRisk.length.toString()} tone={highRisk.length ? "bad" : "neutral"} />
        <StatTile icon={Clock} label="Inactive 14+ days" value={loading ? "—" : ghosting.length.toString()} tone={ghosting.length ? "warn" : "neutral"} />
        <StatTile icon={TrendingDown} label="Avg. churn probability" value={loading ? "—" : `${avgChurnProbability}%`} />
        <StatTile icon={DollarSign} label="MRR at risk" value={loading ? "—" : formatCents(mrrAtRiskCents)} />
      </div>

      <Card className="p-0 overflow-hidden">
        <h2 className="font-display text-lg font-medium text-ink p-6 pb-4">Priority list</h2>
        {loading ? (
          <p className="px-6 pb-6 text-sm text-ink-soft">Scanning member data…</p>
        ) : priorityList.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState>No active members to assess yet.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {priorityList.map((m) => {
              const status = m.retentionScore < 40 ? "Critical" : m.retentionScore < 70 ? "Watch" : "Healthy";
              const lastSeenDays = daysSince(m.lastCheckIn);
              return (
                <li key={m.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-surface-muted flex items-center justify-center text-sm font-medium text-ink-soft">
                      {(m.name || m.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{m.name || m.email}</p>
                      <p className="text-xs text-ink-soft">
                        Last visit {lastSeenDays === null ? "never" : `${lastSeenDays}d ago`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-medium ${m.retentionScore < 40 ? "text-bad" : m.retentionScore < 70 ? "text-warn" : "text-good"}`}>
                      {m.retentionScore}%
                    </span>
                    <Badge variant={status === "Critical" ? "bad" : status === "Watch" ? "warn" : "good"}>{status}</Badge>
                    <a
                      href={`mailto:${m.email}`}
                      aria-label={`Email ${m.name || m.email}`}
                      className="p-2 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
