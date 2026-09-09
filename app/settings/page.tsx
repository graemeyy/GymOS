"use client";

import React, { useState, useEffect } from "react";
import { Building2, DollarSign, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, Button } from "@/components/ui";
import { PLAN_PRICES } from "@/lib/pricing";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const PLAN_LABELS: Record<string, string> = {
  BASIC: "Basic",
  PREMIUM: "Premium",
  PLATINUM: "Platinum",
  ELITE: "Elite",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState({ gymName: "GymOS", address: "", timezone: "America/New_York" });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [pricesSaved, setPricesSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/profile").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/plan-prices").then((r) => (r.ok ? r.json() : PLAN_PRICES)),
    ])
      .then(([profileData, priceData]) => {
        if (profileData) {
          setProfile({
            gymName: profileData.gymName || "GymOS",
            address: profileData.address || "",
            timezone: profileData.timezone || "America/New_York",
          });
        }
        const dollars: Record<string, string> = {};
        for (const plan of Object.keys(PLAN_PRICES)) {
          dollars[plan] = ((priceData[plan] ?? PLAN_PRICES[plan as keyof typeof PLAN_PRICES]) / 100).toString();
        }
        setPrices(dollars);
      })
      .catch((err) => console.error("Failed to load settings:", err))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const savePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrices(true);
    setPricesSaved(false);
    try {
      const payload: Record<string, number> = {};
      for (const plan of Object.keys(prices)) {
        payload[plan] = Math.round(Number(prices[plan]) * 100);
      }
      const res = await fetch("/api/settings/plan-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setPricesSaved(true);
        setTimeout(() => setPricesSaved(false), 2000);
      }
    } finally {
      setSavingPrices(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Settings" description="Gym profile and membership pricing." />
        <p className="text-sm text-ink-soft">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Settings" description="Gym profile and membership pricing." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="w-4.5 h-4.5 text-ink-soft" />
            <h2 className="font-display text-lg font-medium text-ink">Gym profile</h2>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Gym name</label>
              <input
                required
                value={profile.gymName}
                onChange={(e) => setProfile({ ...profile, gymName: e.target.value })}
                className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Address</label>
              <input
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Optional"
                className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Timezone</label>
              <select
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={savingProfile} className="mt-2">
              {profileSaved ? <Check className="w-4 h-4" /> : null}
              {savingProfile ? "Saving…" : profileSaved ? "Saved" : "Save profile"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-5">
            <DollarSign className="w-4.5 h-4.5 text-ink-soft" />
            <h2 className="font-display text-lg font-medium text-ink">Membership pricing</h2>
          </div>
          <form onSubmit={savePrices} className="space-y-4">
            {Object.keys(PLAN_PRICES).map((plan) => (
              <div key={plan} className="space-y-1.5">
                <label className="text-sm font-medium text-ink">{PLAN_LABELS[plan]} — monthly</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={prices[plan] ?? ""}
                    onChange={(e) => setPrices({ ...prices, [plan]: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl pl-7 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
              </div>
            ))}
            <Button type="submit" disabled={savingPrices} className="mt-2">
              {pricesSaved ? <Check className="w-4 h-4" /> : null}
              {savingPrices ? "Saving…" : pricesSaved ? "Saved" : "Save pricing"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
