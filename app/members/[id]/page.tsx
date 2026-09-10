"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, CreditCard, KeyRound, ShieldAlert, ListPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, Badge, StatTile, EmptyState, LinkButton } from "@/components/ui";
import { formatCents } from "@/lib/pricing";

interface CheckIn {
  id: string;
  location: string;
  timestamp: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface ClassBooking {
  id: string;
  class: { id: string; name: string; startTime: string; instructor: string | null };
}

interface WaitlistEntry {
  id: string;
  class: { id: string; name: string; startTime: string };
}

interface MemberDetail {
  id: string;
  name: string | null;
  email: string;
  status: string;
  plan: string;
  keycardIssued: boolean;
  lastCheckIn: string | null;
  retentionScore: number;
  createdAt: string;
  checkIns: CheckIn[];
  payouts: Payout[];
  classBookings: ClassBooking[];
  classWaitlist: WaitlistEntry[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function MemberDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => data && setMember(data))
      .catch((err) => console.error("Failed to load member:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Member" description="Loading…" />
        <p className="text-sm text-ink-soft">Loading…</p>
      </AppShell>
    );
  }

  if (notFound || !member) {
    return (
      <AppShell>
        <PageHeader title="Member not found" />
        <LinkButton href="/members" variant="secondary">
          <ArrowLeft className="w-4 h-4" /> Back to members
        </LinkButton>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <LinkButton href="/members" variant="ghost" className="!px-0">
          <ArrowLeft className="w-4 h-4" /> Back to members
        </LinkButton>
      </div>

      <PageHeader
        title={member.name || member.email}
        description={member.email}
        action={
          <div className="flex gap-2">
            <Badge variant={member.status === "ACTIVE" ? "good" : "neutral"}>{member.status}</Badge>
            <Badge>{member.plan}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile
          icon={ShieldAlert}
          label="Retention score"
          value={`${member.retentionScore}%`}
          tone={member.retentionScore < 40 ? "bad" : member.retentionScore < 70 ? "warn" : "good"}
        />
        <StatTile
          icon={Clock}
          label="Last check-in"
          value={member.lastCheckIn ? formatDate(member.lastCheckIn) : "Never"}
        />
        <StatTile
          icon={KeyRound}
          label="Keycard"
          value={member.keycardIssued ? "Issued" : "Not issued"}
          tone={member.keycardIssued ? "good" : "neutral"}
        />
        <StatTile icon={CalendarDays} label="Member since" value={formatDate(member.createdAt)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4.5 h-4.5 text-ink-soft" />
            <h2 className="font-display text-lg font-medium text-ink">Upcoming classes</h2>
          </div>
          {member.classBookings.length === 0 ? (
            <EmptyState>No upcoming classes booked.</EmptyState>
          ) : (
            <ul className="divide-y divide-line -mx-6">
              {member.classBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{b.class.name}</p>
                    <p className="text-xs text-ink-soft">{b.class.instructor ? `with ${b.class.instructor}` : "No instructor assigned"}</p>
                  </div>
                  <span className="text-xs text-ink-soft">{formatDateTime(b.class.startTime)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {member.classWaitlist.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <ListPlus className="w-4.5 h-4.5 text-ink-soft" />
              <h2 className="font-display text-lg font-medium text-ink">Waitlisted for</h2>
            </div>
            <ul className="divide-y divide-line -mx-6">
              {member.classWaitlist.map((w) => (
                <li key={w.id} className="flex items-center justify-between px-6 py-3">
                  <p className="text-sm font-medium text-ink">{w.class.name}</p>
                  <span className="text-xs text-ink-soft">{formatDateTime(w.class.startTime)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4.5 h-4.5 text-ink-soft" />
            <h2 className="font-display text-lg font-medium text-ink">Recent check-ins</h2>
          </div>
          {member.checkIns.length === 0 ? (
            <EmptyState>No check-ins recorded yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line -mx-6">
              {member.checkIns.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-6 py-3">
                  <span className="text-sm text-ink">{c.location}</span>
                  <span className="text-xs text-ink-soft">{formatDateTime(c.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4.5 h-4.5 text-ink-soft" />
            <h2 className="font-display text-lg font-medium text-ink">Recent payments</h2>
          </div>
          {member.payouts.length === 0 ? (
            <EmptyState>No payments recorded yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line -mx-6">
              {member.payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-6 py-3">
                  <span className="text-sm text-ink">{formatCents(p.amount)}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant={p.status === "succeeded" ? "good" : "neutral"}>{p.status}</Badge>
                    <span className="text-xs text-ink-soft">{formatDateTime(p.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
