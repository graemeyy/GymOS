"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, Trash2, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/components/SessionProvider";
import { Card, PageHeader, Badge, Button, EmptyState } from "@/components/ui";
import { ROLE_LABELS, type StaffRoleName } from "@/lib/roles";

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  staff: { id: string; name: string; role: StaffRoleName };
}

interface StaffMember {
  id: string;
  name: string;
  role: StaffRoleName;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ShiftsPage() {
  const { hasRole } = useSession();
  const canManage = hasRole("MANAGER");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ staffId: "", date: "", startTime: "", endTime: "", notes: "" });

  const fetchAll = async () => {
    try {
      const requests: Promise<Response>[] = [fetch("/api/shifts")];
      if (canManage) requests.push(fetch("/api/staff"));
      const results = await Promise.all(requests);
      if (results[0].ok) setShifts(await results[0].json());
      if (canManage && results[1]?.ok) setStaff(await results[1].json());
    } catch (err) {
      console.error("Failed to load shifts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.staffId || !formData.date || !formData.startTime || !formData.endTime) {
      setError("All fields except notes are required");
      return;
    }
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: formData.staffId,
          startTime: new Date(`${formData.date}T${formData.startTime}`).toISOString(),
          endTime: new Date(`${formData.date}T${formData.endTime}`).toISOString(),
          notes: formData.notes || null,
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ staffId: "", date: "", startTime: "", endTime: "", notes: "" });
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create shift");
      }
    } catch {
      setError("Network error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this shift?")) return;
    const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  return (
    <AppShell>
      <PageHeader
        title="Shifts"
        description="Staff scheduling."
        action={
          canManage ? (
            <Button onClick={() => { setError(null); setIsModalOpen(true); }}>
              <Plus className="w-4 h-4" /> Add shift
            </Button>
          ) : undefined
        }
      />

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-sm text-ink-soft">Loading shifts…</p>
        ) : shifts.length === 0 ? (
          <div className="p-6">
            <EmptyState>No upcoming shifts scheduled.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {shifts.map((shift) => (
              <li key={shift.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-ember-soft text-ember-dark flex items-center justify-center text-xs font-medium">
                    {shift.staff.name[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{shift.staff.name}</p>
                    <p className="text-xs text-ink-soft">{ROLE_LABELS[shift.staff.role]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-ink flex items-center gap-1.5 justify-end">
                      <Clock className="w-3.5 h-3.5 text-ink-soft" />
                      {formatWhen(shift.startTime)}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                    </p>
                  </div>
                  {shift.notes && <Badge>{shift.notes}</Badge>}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(shift.id)}
                      aria-label={`Remove shift for ${shift.staff.name}`}
                      className="p-2 rounded-lg text-ink-soft hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
            <h2 className="font-display text-xl font-medium text-ink mb-6">Add shift</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Staff member</label>
                <select
                  required
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                >
                  <option value="">Select a staff member…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {ROLE_LABELS[s.role]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Date</label>
                <input
                  required
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Start time</label>
                  <input
                    required
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">End time</label>
                  <input
                    required
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Notes</label>
                <input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional"
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                />
              </div>
              {error && <p className="text-sm text-bad">{error}</p>}
              <Button type="submit" className="w-full mt-2">Add shift</Button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
