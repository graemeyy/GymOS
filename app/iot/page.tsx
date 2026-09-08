"use client";

import React, { useState, useEffect } from "react";
import { ScanFace, UserCheck, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";

export default function AccessControlPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/check-in");
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error("Failed to fetch gateway events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const mainEntry = events.filter((ev: any) => ev.location === "Main Entrance").length;
  const otherGateways = events.length - mainEntry;

  return (
    <AppShell>
      <PageHeader title="Access control" description="Entry gateway activity, updated live." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg font-medium text-ink mb-4">Recent scans</h2>
          {loading ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : events.length === 0 ? (
            <EmptyState>No gateway scans recorded yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((ev: any) => {
                const denied = ev.member?.status !== "ACTIVE";
                return (
                  <li key={ev.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${denied ? "bg-bad-soft text-bad" : "bg-good-soft text-good"}`}>
                        {denied ? <XCircle className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{ev.member?.name || ev.member?.email || "Unknown"}</p>
                        <p className="text-xs text-ink-soft">{ev.location} · {new Date(ev.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <Badge variant={denied ? "bad" : "good"}>{denied ? "Denied" : "Granted"}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-lg font-medium text-ink mb-4">Gateways</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-line p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Main entrance</p>
                  <p className="text-xs text-ink-soft">{mainEntry} scans (last 10)</p>
                </div>
                <Badge variant={mainEntry > 0 ? "good" : "neutral"}>{mainEntry > 0 ? "Active" : "Idle"}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Other gateways</p>
                  <p className="text-xs text-ink-soft">{otherGateways} scans (last 10)</p>
                </div>
                <Badge variant={otherGateways > 0 ? "good" : "neutral"}>{otherGateways > 0 ? "Active" : "Idle"}</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-3 text-ink-soft">
              <ScanFace className="w-4 h-4" />
              <h2 className="text-sm font-medium text-ink">Hardware endpoint</h2>
            </div>
            <p className="text-xs text-ink-soft mb-3">
              Point your entry scanners at this endpoint, authenticated with the gateway secret from your environment config.
            </p>
            <code className="block text-xs bg-chalk border border-line rounded-lg px-3 py-2 text-ink-soft">
              POST /api/iot/checkin
            </code>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
