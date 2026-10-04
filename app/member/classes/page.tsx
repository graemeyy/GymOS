"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { fmtDayHeading, fmtTime } from "@/lib/format";
import { gym } from "@/lib/config/client";
import { Button, IconButton, PageHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { useMe } from "@/components/member/member-shell";
import { localDateIn } from "@/lib/dates";
import { DAY_MS, HOUR_MS } from "@/lib/time";

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

const dayKey = (d: string) => localDateIn(gym.business.timezone, new Date(d));

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function MemberClassesPage() {
  const me = useMe();
  const [week, setWeek] = useState(0);
  const range = useMemo(() => {
    const from = new Date(startOfToday().getTime() + week * 7 * DAY_MS);
    const start = week === 0 ? new Date(Math.max(from.getTime(), Date.now() - HOUR_MS)) : from;
    start.setMinutes(0, 0, 0);
    return { from: start.toISOString(), to: new Date(from.getTime() + 7 * DAY_MS).toISOString() };
  }, [week]);
  const timetable = useResource<Timetable>(`/api/me/classes?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
  const reload = async () => {
    await Promise.all([timetable.reload(), me.reload()]);
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
                    {fmtDayHeading(rows[0].startTime)}
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
                          <ClassAction cls={c} onDone={reload} />
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

// Each row has its own mutation, so several classes can be booked at once
// and one finishing doesn't re-enable another that's still being sent (R-61).
function ClassAction({ cls, onDone }: { cls: ClassRow; onDone: () => Promise<void> }) {
  const toast = useToast();
  const action = useMutation(
    (method: "POST" | "DELETE", kind: "booking" | "waitlist") => api<{ late?: boolean; creditReturned?: boolean }>(`/api/me/classes/${cls.id}/${kind}`, { method }),
    {
      onSuccess: async (res, method, kind) => {
        if (kind === "booking" && method === "POST") toast(`Booked: ${cls.name} at ${fmtTime(cls.startTime)}.`);
        if (kind === "booking" && method === "DELETE") toast(res.late && !res.creditReturned ? "Booking cancelled. It was a late cancellation, so the class credit was used." : "Booking cancelled.");
        if (kind === "waitlist") toast(method === "POST" ? "You're on the waitlist. We'll book you in if a spot opens." : "Left the waitlist.");
        await onDone();
      },
      onError: (e) => toast(e.message, "bad"),
    }
  );
  const busy = action.busy;
  const started = new Date(cls.startTime).getTime() <= Date.now();
  if (started) return <span className="text-sm text-ink-soft">Started</span>;
  const label = `${cls.name} at ${fmtTime(cls.startTime)}`;
  if (cls.booked)
    return (
      <Button variant="secondary" busy={busy} onClick={() => void action.run("DELETE", "booking")} aria-label={`Cancel booking for ${label}`}>
        Cancel booking
      </Button>
    );
  if (cls.waitlistPosition)
    return (
      <Button variant="ghost" busy={busy} onClick={() => void action.run("DELETE", "waitlist")} aria-label={`Leave waitlist for ${label}`}>
        Leave waitlist
      </Button>
    );
  if (!cls.bookingOpen) return <span className="text-sm text-ink-soft">Booking not open yet</span>;
  if (cls.spotsLeft > 0)
    return (
      <Button busy={busy} onClick={() => void action.run("POST", "booking")} aria-label={`Book ${label}`}>
        Book
      </Button>
    );
  return (
    <Button variant="secondary" busy={busy} onClick={() => void action.run("POST", "waitlist")} aria-label={`Join waitlist for ${label}`}>
      Join waitlist
    </Button>
  );
}
