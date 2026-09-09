"use client";

import React, { useState, useEffect } from "react";
import { Building2, DollarSign, Check, Users, ScrollText, Plus, X, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/components/SessionProvider";
import { Card, PageHeader, Button, EmptyState, Badge } from "@/components/ui";
import { PLAN_PRICES } from "@/lib/pricing";
import { ROLE_LABELS, type StaffRoleName } from "@/lib/roles";

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

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRoleName;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  staffName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: unknown;
  createdAt: string;
}

function GymProfileCard({ canEdit }: { canEdit: boolean }) {
  const [profile, setProfile] = useState({ gymName: "GymOS", address: "", timezone: "America/New_York" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            gymName: data.gymName || "GymOS",
            address: data.address || "",
            timezone: data.timezone || "America/New_York",
          });
        }
      })
      .catch((err) => console.error("Failed to load profile:", err))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <Building2 className="w-4.5 h-4.5 text-ink-soft" />
        <h2 className="font-display text-lg font-medium text-ink">Gym profile</h2>
      </div>
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <form onSubmit={saveProfile} className="space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-60">
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
          </fieldset>
          {canEdit ? (
            <Button type="submit" disabled={saving} className="mt-2">
              {saved ? <Check className="w-4 h-4" /> : null}
              {saving ? "Saving…" : saved ? "Saved" : "Save profile"}
            </Button>
          ) : (
            <p className="text-xs text-ink-soft">Only managers and owners can edit the gym profile.</p>
          )}
        </form>
      )}
    </Card>
  );
}

function PricingCard({ canEdit }: { canEdit: boolean }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/plan-prices")
      .then((r) => (r.ok ? r.json() : PLAN_PRICES))
      .then((priceData) => {
        const dollars: Record<string, string> = {};
        for (const plan of Object.keys(PLAN_PRICES)) {
          dollars[plan] = ((priceData[plan] ?? PLAN_PRICES[plan as keyof typeof PLAN_PRICES]) / 100).toString();
        }
        setPrices(dollars);
      })
      .catch((err) => console.error("Failed to load plan prices:", err))
      .finally(() => setLoading(false));
  }, []);

  const savePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
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
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <DollarSign className="w-4.5 h-4.5 text-ink-soft" />
        <h2 className="font-display text-lg font-medium text-ink">Membership pricing</h2>
      </div>
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <form onSubmit={savePrices} className="space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-60">
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
          </fieldset>
          {canEdit ? (
            <Button type="submit" disabled={saving} className="mt-2">
              {saved ? <Check className="w-4 h-4" /> : null}
              {saving ? "Saving…" : saved ? "Saved" : "Save pricing"}
            </Button>
          ) : (
            <p className="text-xs text-ink-soft">Only owners can change membership pricing.</p>
          )}
        </form>
      )}
    </Card>
  );
}

function StaffCard() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "FRONT_DESK" as StaffRoleName });

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/staff");
      if (res.ok) setStaff(await res.json());
    } catch (err) {
      console.error("Failed to load staff:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: "", email: "", password: "", role: "FRONT_DESK" });
        fetchStaff();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create staff account");
      }
    } catch {
      setError("Network error");
    }
  };

  const handleRoleChange = async (id: string, role: StaffRoleName) => {
    const res = await fetch(`/api/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) fetchStaff();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to update role");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}'s staff account? This can't be undone.`)) return;
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    if (res.ok) fetchStaff();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to remove staff account");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users className="w-4.5 h-4.5 text-ink-soft" />
          <h2 className="font-display text-lg font-medium text-ink">Staff accounts</h2>
        </div>
        <Button
          variant="secondary"
          className="!px-3 !py-1.5 text-xs"
          onClick={() => { setError(null); setIsModalOpen(true); }}
        >
          <Plus className="w-3.5 h-3.5" /> Add staff
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : staff.length === 0 ? (
        <EmptyState>No staff accounts yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-line -mx-6">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-6 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                <p className="text-xs text-ink-soft truncate">{s.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={s.role}
                  onChange={(e) => handleRoleChange(s.id, e.target.value as StaffRoleName)}
                  className="bg-chalk border border-line rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ember/30"
                >
                  <option value="OWNER">Owner</option>
                  <option value="MANAGER">Manager</option>
                  <option value="FRONT_DESK">Front desk</option>
                </select>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  aria-label={`Remove ${s.name}`}
                  className="p-1.5 rounded-lg text-ink-soft hover:bg-bad-soft hover:text-bad"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/30">
          <Card className="w-full max-w-md relative">
            <button
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              className="absolute right-5 top-5 p-1.5 rounded-lg text-ink-soft hover:bg-surface-muted"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="font-display text-xl font-medium text-ink mb-6">Add staff account</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Full name</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Email address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Temporary password</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as StaffRoleName })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                >
                  <option value="FRONT_DESK">Front desk</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              {error && <p className="text-sm text-bad">{error}</p>}
              <Button type="submit" className="w-full mt-2">Create account</Button>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}

function formatDetails(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function AuditLogCard() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit-log")
      .then((r) => (r.ok ? r.json() : []))
      .then(setLogs)
      .catch((err) => console.error("Failed to load audit log:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center gap-2 mb-5">
        <ScrollText className="w-4.5 h-4.5 text-ink-soft" />
        <h2 className="font-display text-lg font-medium text-ink">Audit log</h2>
      </div>
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : logs.length === 0 ? (
        <EmptyState>No activity recorded yet.</EmptyState>
      ) : (
        <div className="max-h-96 overflow-y-auto -mx-6">
          <ul className="divide-y divide-line">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{log.staffName}</span>{" "}
                    <Badge>{log.action}</Badge>
                  </p>
                  {log.details ? (
                    <p className="text-xs text-ink-soft mt-1 truncate">{formatDetails(log.details)}</p>
                  ) : null}
                </div>
                <span className="text-xs text-ink-soft shrink-0">
                  {new Date(log.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { hasRole, loading: sessionLoading } = useSession();

  return (
    <AppShell>
      <PageHeader title="Settings" description="Gym profile, membership pricing, staff, and activity." />

      {sessionLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GymProfileCard canEdit={hasRole("MANAGER")} />
          <PricingCard canEdit={hasRole("OWNER")} />
          {hasRole("OWNER") && <StaffCard />}
          {hasRole("MANAGER") && <AuditLogCard />}
        </div>
      )}
    </AppShell>
  );
}
