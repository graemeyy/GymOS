"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, UserPlus, Trash2, Clock, ListPlus, ArrowUpCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/components/SessionProvider";
import { Card, PageHeader, Badge, Button, EmptyState } from "@/components/ui";

interface Booking {
  id: string;
  memberId: string;
  status: "BOOKED" | "ATTENDED" | "NO_SHOW";
  member: { id: string; name: string | null; email: string };
}

interface WaitlistEntry {
  id: string;
  memberId: string;
  member: { id: string; name: string | null; email: string };
}

interface GymClass {
  id: string;
  name: string;
  instructor: string | null;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  bookings: Booking[];
  waitlist: WaitlistEntry[];
}

interface Member {
  id: string;
  name: string;
  email: string;
  status: string;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ClassesPage() {
  const { hasRole } = useSession();
  const canManage = hasRole("MANAGER");
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingFor, setBookingFor] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [formData, setFormData] = useState({ name: "", instructor: "", date: "", time: "", durationMinutes: "45", capacity: "20" });
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const [classesRes, membersRes] = await Promise.all([fetch("/api/classes"), fetch("/api/members")]);
      if (classesRes.ok) setClasses(await classesRes.json());
      if (membersRes.ok) setMembers(await membersRes.json());
    } catch (err) {
      console.error("Failed to load classes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.date || !formData.time) {
      setError("Date and time are required");
      return;
    }
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          instructor: formData.instructor || null,
          startTime: new Date(`${formData.date}T${formData.time}`).toISOString(),
          durationMinutes: Number(formData.durationMinutes),
          capacity: Number(formData.capacity),
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: "", instructor: "", date: "", time: "", durationMinutes: "45", capacity: "20" });
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create class");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  const handleCancelClass = async (id: string) => {
    if (!confirm("Cancel this class? This can't be undone.")) return;
    const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  const handleBook = async (classId: string) => {
    if (!selectedMemberId) return;
    const res = await fetch(`/api/classes/${classId}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: selectedMemberId }),
    });
    if (res.ok) {
      setBookingFor(null);
      setSelectedMemberId("");
      fetchAll();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to book member");
    }
  };

  const handleUnbook = async (classId: string, memberId: string) => {
    const res = await fetch(`/api/classes/${classId}/book?memberId=${memberId}`, { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  const handleMarkAttendance = async (classId: string, memberId: string, status: "ATTENDED" | "NO_SHOW") => {
    const res = await fetch(`/api/classes/${classId}/book`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, status }),
    });
    if (res.ok) fetchAll();
  };

  const handleJoinWaitlist = async (classId: string) => {
    if (!selectedMemberId) return;
    const res = await fetch(`/api/classes/${classId}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: selectedMemberId }),
    });
    if (res.ok) {
      setBookingFor(null);
      setSelectedMemberId("");
      fetchAll();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to add member to waitlist");
    }
  };

  const handleLeaveWaitlist = async (classId: string, memberId: string) => {
    const res = await fetch(`/api/classes/${classId}/waitlist?memberId=${memberId}`, { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  const handlePromote = async (classId: string, memberId: string) => {
    const res = await fetch(`/api/classes/${classId}/waitlist/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) fetchAll();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to promote member");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Classes"
        description="Upcoming sessions and who's booked in."
        action={
          canManage ? (
            <Button onClick={() => { setError(null); setIsModalOpen(true); }}>
              <Plus className="w-4 h-4" /> Add class
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <p className="text-sm text-ink-soft">Loading classes…</p>
      ) : classes.length === 0 ? (
        <EmptyState>No upcoming classes — add your first one.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {classes.map((cls) => {
            const spotsLeft = cls.capacity - cls.bookings.length;
            const bookedIds = new Set(cls.bookings.map((b) => b.memberId));
            const waitlistedIds = new Set(cls.waitlist.map((w) => w.memberId));
            const availableMembers = members.filter(
              (m) => m.status === "ACTIVE" && !bookedIds.has(m.id) && !waitlistedIds.has(m.id)
            );
            const isFull = spotsLeft <= 0;
            const hasStarted = new Date(cls.startTime).getTime() <= Date.now();

            return (
              <Card key={cls.id}>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h2 className="font-display text-lg font-medium text-ink">{cls.name}</h2>
                    <p className="text-sm text-ink-soft">{cls.instructor ? `with ${cls.instructor}` : "No instructor assigned"}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleCancelClass(cls.id)}
                      aria-label={`Cancel ${cls.name}`}
                      className="p-2 rounded-lg text-ink-soft hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-ink-soft mb-4">
                  <Clock className="w-3.5 h-3.5" />
                  {formatWhen(cls.startTime)} · {cls.durationMinutes} min
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ink">Roster</span>
                  <Badge variant={spotsLeft === 0 ? "bad" : spotsLeft <= 3 ? "warn" : "good"}>
                    {spotsLeft <= 0 ? "Full" : `${spotsLeft}/${cls.capacity} spots left`}
                  </Badge>
                </div>

                {cls.bookings.length === 0 ? (
                  <p className="text-sm text-ink-soft mb-4">No one booked yet.</p>
                ) : (
                  <ul className="space-y-1.5 mb-4">
                    {cls.bookings.map((b) => (
                      <li key={b.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink">{b.member.name || b.member.email}</span>
                        <div className="flex items-center gap-2.5">
                          {hasStarted && b.status === "BOOKED" && (
                            <>
                              <button
                                onClick={() => handleMarkAttendance(cls.id, b.memberId, "ATTENDED")}
                                className="text-xs text-good hover:underline"
                              >
                                Attended
                              </button>
                              <button
                                onClick={() => handleMarkAttendance(cls.id, b.memberId, "NO_SHOW")}
                                className="text-xs text-bad hover:underline"
                              >
                                No-show
                              </button>
                            </>
                          )}
                          {b.status === "ATTENDED" && <Badge variant="good">Attended</Badge>}
                          {b.status === "NO_SHOW" && <Badge variant="bad">No-show</Badge>}
                          <button
                            onClick={() => handleUnbook(cls.id, b.memberId)}
                            className="text-xs text-ink-soft hover:text-bad"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {cls.waitlist.length > 0 && (
                  <div className="mb-4">
                    <span className="text-sm font-medium text-ink">Waitlist</span>
                    <ul className="space-y-1.5 mt-2">
                      {cls.waitlist.map((w, i) => (
                        <li key={w.id} className="flex items-center justify-between text-sm">
                          <span className="text-ink">
                            <span className="text-ink-soft">{i + 1}.</span> {w.member.name || w.member.email}
                          </span>
                          <div className="flex items-center gap-3">
                            {!isFull && (
                              <button
                                onClick={() => handlePromote(cls.id, w.memberId)}
                                className="flex items-center gap-1 text-xs text-ember hover:text-ember-dark"
                              >
                                <ArrowUpCircle className="w-3.5 h-3.5" /> Promote
                              </button>
                            )}
                            <button
                              onClick={() => handleLeaveWaitlist(cls.id, w.memberId)}
                              className="text-xs text-ink-soft hover:text-bad"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bookingFor === cls.id ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="flex-1 bg-chalk border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                    >
                      <option value="">Select a member…</option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name || m.email}</option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      className="!px-3"
                      onClick={() => (isFull ? handleJoinWaitlist(cls.id) : handleBook(cls.id))}
                      disabled={!selectedMemberId}
                    >
                      {isFull ? "Waitlist" : "Book"}
                    </Button>
                    <button onClick={() => { setBookingFor(null); setSelectedMemberId(""); }} className="p-2 text-ink-soft hover:text-ink">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full !py-2 text-xs"
                    onClick={() => setBookingFor(cls.id)}
                    disabled={availableMembers.length === 0}
                  >
                    {isFull ? <ListPlus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {isFull ? "Join waitlist" : "Book a member"}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

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
            <h2 className="font-display text-xl font-medium text-ink mb-6">Add class</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Class name</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  placeholder="HIIT"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Instructor</label>
                <input
                  value={formData.instructor}
                  onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Time</label>
                  <input
                    required
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Duration (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-bad">{error}</p>}
              <Button type="submit" className="w-full mt-2">Add class</Button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
