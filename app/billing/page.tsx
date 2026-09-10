"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, StatTile, Badge, EmptyState, LinkButton, Button } from "@/components/ui";
import { formatCents } from "@/lib/pricing";
import { downloadCsv } from "@/lib/csv";

interface Payout {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  member: { name: string | null; email: string; plan: string } | null;
}

export default function BillingPage() {
  const [mrrCents, setMrrCents] = useState<number | null>(null);
  const [activeMembers, setActiveMembers] = useState<number | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/payouts").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([stats, payoutData]) => {
        if (stats) {
          setMrrCents(stats.revenueCents);
          setActiveMembers(stats.activeMembers);
        }
        setPayouts(Array.isArray(payoutData) ? payoutData : []);
      })
      .catch((err) => console.error("Failed to load billing data:", err))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    downloadCsv("billing.csv", payouts, [
      { header: "Member", value: (p) => p.member?.name || p.member?.email || "Unknown" },
      { header: "Plan", value: (p) => p.member?.plan || "" },
      { header: "Amount", value: (p) => (p.amount / 100).toFixed(2) },
      { header: "Status", value: (p) => p.status },
      { header: "Date", value: (p) => new Date(p.createdAt).toLocaleDateString() },
    ]);
  };

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Recurring revenue and recent payments."
        action={
          <Button variant="secondary" onClick={exportCsv} disabled={payouts.length === 0}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatTile
          icon={DollarSign}
          label="Monthly recurring revenue"
          value={loading || mrrCents === null ? "—" : formatCents(mrrCents)}
        />
        <StatTile
          icon={DollarSign}
          label="Paying members"
          value={loading || activeMembers === null ? "—" : activeMembers.toLocaleString()}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="font-display text-lg font-medium text-ink">Recent transactions</h2>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-ink-soft">Loading…</p>
        ) : payouts.length === 0 ? (
          <div className="p-6">
            <EmptyState>
              No transactions recorded yet. They'll show up here as members pay through Stripe.
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-left text-xs text-ink-soft border-b border-line">
                <th className="font-medium px-6 py-3">Member</th>
                <th className="font-medium px-6 py-3">Plan</th>
                <th className="font-medium px-6 py-3">Amount</th>
                <th className="font-medium px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-ink">{p.member?.name || p.member?.email || "Unknown"}</td>
                  <td className="px-6 py-4"><Badge>{p.member?.plan || "—"}</Badge></td>
                  <td className="px-6 py-4 text-ink">{formatCents(p.amount)}</td>
                  <td className="px-6 py-4 text-right">
                    <Badge variant={p.status === "succeeded" ? "good" : "neutral"}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">Retention watchlist</h2>
          <p className="text-sm text-ink-soft mt-1">See which members are at risk of canceling.</p>
        </div>
        <LinkButton href="/radar" variant="secondary">
          Open retention
        </LinkButton>
      </Card>
    </AppShell>
  );
}
