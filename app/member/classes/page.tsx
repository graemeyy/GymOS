"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { fmtTime } from "@/lib/client/format";
import { gym } from "@/lib/config/client";
import { Button, IconButton, PageHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { useMe } from "@/components/member/member-shell";

interface ClassRow {
  id: string;
  name: string;
  startTime: string;
  durationMinutes: number;
  coach: string | null;
  capacity: number;
  spotsLeft: number;
  waitlistLength: number;
  booked: boolean;
  waitlistPosition: number | null;
  bookingOpen: boolean;
}
interface Timetable {
  bookingOpensDaysAhead: number;
  cancelWithoutPenaltyHours: number;
  lateCancelForfeitsCredit: boolean;
  classes: ClassRow[];
}

const tz = gym.business.timezone;
const dayKey = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
const dayHeading = (d: string) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(d));

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function MemberClassesPage() {
  const me = useMe();
  const [week, setWeek] = useState(0);
  const range = useMemo(() => {
    const from = new Date(startOfToday().getTime() + week * 7 * 86_400_000);
    const start = week === 0 ? new Date(Math.max(from.getTime(), Date.now() - 3_600_000)) : from;
    start.setMinutes(0, 0, 0);
    return { from: start.toISOString(), to: new Date(from.getTime() + 7 * 86_400_000).toISOString() };
  }, [week]);
  const timetable = useResource<Timetable>(`/api/me/classes?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
  const toast = useToast();
  // One entry per pending class: a single busy ID let a second booking
  // re-enable the first while it was still being sent (R-61).
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  const act = async (cls: ClassRow, method: "POST" | "DELETE", kind: "booking" | "waitlist") => {
    setBusyIds((ids) => new Set(ids).add(cls.id));
    try {
      const res = await api<{ late?: boolean; creditReturned?: boolean }>(`/api/me/classes/${cls.id}/${kind}`, { method });
      if (kind === "booking" && method === "POST") toast(`Booked: ${cls.name} at ${fmtTime(cls.startTime)}.`);
      if (kind === "booking" && method === "DELETE") toast(res.late && !res.creditReturned ? "Booking cancelled. It was a late cancellation, so the class credit was used." : "Booking cancelled.");
      if (kind === "waitlist") toast(method === "POST" ? "You're on the waitlist. We'll book you in if a spot opens." : "Left the waitlist.");
      await Promise.all([timetable.reload(), me.reload()]);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "That didn't work. Try again.", "bad");
    } finally {
      setBusyIds((ids) => {
        const next = new Set(ids);
        next.delete(cls.id);
        return next;
      });
    }
  };

  const credits = me.data?.usage.classCreditsRemaining;

  return (
    <div>
      <PageHeader
        title="Classes"
        description={
          timetable.data
            ? `Booking opens ${timetable.data.bookingOpensDaysAhead} days ahead. Cancel at least ${timetable.data.cancelWithoutPenaltyHours} hours before${timetable.data.lateCancelForfeitsCredit ? " to keep your class credit" : ""}.`
            : undefined
        }
      />
      {credits !== undefined && credits !== null ? (
        <p className="mb-4 rounded border border-line bg-sunken px-4 py-3 text-sm">
          {credits > 0 ? `${credits} class ${credits === 1 ? "credit" : "credits"} left this billing cycle.` : "You've used this cycle's class credits. Upgrade your plan or book a casual class at the front desk."}
        </p>
      ) : null}
      <div className="mb-4 flex items-center justify-between gap-2">
        <IconButton label="Previous week" onClick={() => setWeek((w) => Math.max(0, w - 1))} disabled={week === 0}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <p className="font-medium" aria-live="polite">
          {week === 0 ? "This week" : week === 1 ? "Next week" : `In ${week} weeks`}
        </p>
        <IconButton label="Next week" onClick={() => setWeek((w) => Math.min(3, w + 1))} disabled={week === 3}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </div>
      <AsyncBlock loading={timetable.loading} error={timetable.error} data={timetable.data} onRetry={timetable.reload} loadingLabel="Loading the timetable">
        {(data) => {
          if (data.classes.length === 0) return <EmptyState title="No classes this week">Check the next week, or ask at the front desk.</EmptyState>;
          const days = new Map<string, ClassRow[]>();
          for (const c of data.classes) days.set(dayKey(c.startTime), [...(days.get(dayKey(c.startTime)) ?? []), c]);
          return (
            <div className="space-y-6">
              {[...days.entries()].map(([key, rows]) => (
                <section key={key} aria-labelledby={`day-${key}`}>
                  <h2 id={`day-${key}`} className="mb-2 text-xl">
                    {dayHeading(rows[0].startTime)}
                  </h2>
                  <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                    {rows.map((c) => (
                      <li key={c.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-4">
                          <p className="tabular w-[4.75rem] shrink-0 whitespace-nowrap font-display text-xl font-bold">{fmtTime(c.startTime)}</p>
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="text-sm text-ink-soft">
                              {c.durationMinutes} min{c.coach ? ` with ${c.coach}` : ""}.{" "}
                              {c.booked ? null : c.spotsLeft > 0 ? `${c.spotsLeft} of ${c.capacity} spots left.` : `Full${c.waitlistLength ? `, ${c.waitlistLength} waiting` : ""}.`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pl-[5.75rem] sm:justify-end sm:pl-0">
                          {c.booked ? <StatusTag tone="good">Booked</StatusTag> : null}
                          {c.waitlistPosition ? <StatusTag tone="warn">{`Waitlist #${c.waitlistPosition}`}</StatusTag> : null}
                          <ClassAction cls={c} busy={busyIds.has(c.id)} onAct={act} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          );
        }}
      </AsyncBlock>
    </div>
  );
}

function ClassAction({ cls, busy, onAct }: { cls: ClassRow; busy: boolean; onAct: (c: ClassRow, m: "POST" | "DELETE", k: "booking" | "waitlist") => void }) {
  const started = new Date(cls.startTime).getTime() <= Date.now();
  if (started) return <span className="text-sm text-ink-soft">Started</span>;
  const label = `${cls.name} at ${fmtTime(cls.startTime)}`;
  if (cls.booked)
    return (
      <Button variant="secondary" busy={busy} onClick={() => onAct(cls, "DELETE", "booking")} aria-label={`Cancel booking for ${label}`}>
        Cancel booking
      </Button>
    );
  if (cls.waitlistPosition)
    return (
      <Button variant="ghost" busy={busy} onClick={() => onAct(cls, "DELETE", "waitlist")} aria-label={`Leave waitlist for ${label}`}>
        Leave waitlist
      </Button>
    );
  if (!cls.bookingOpen) return <span className="text-sm text-ink-soft">Booking not open yet</span>;
  if (cls.spotsLeft > 0)
    return (
      <Button busy={busy} onClick={() => onAct(cls, "POST", "booking")} aria-label={`Book ${label}`}>
        Book
      </Button>
    );
  return (
    <Button variant="secondary" busy={busy} onClick={() => onAct(cls, "POST", "waitlist")} aria-label={`Join waitlist for ${label}`}>
      Join waitlist
    </Button>
  );
}
