"use client";

import React, { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useResource } from "@/lib/client/api";
import { localDateIn } from "@/lib/dates";
import { gym } from "@/lib/config/client";
import { fmtDayHeading } from "@/lib/format";
import { useStaff } from "@/components/admin/staff-session";
import { ownClassesOnly } from "@/lib/auth/permissions";
import { Button, IconButton, LinkButton, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { ClassCard } from "@/components/admin/classes/class-card";
import { NewClassDialog } from "@/components/admin/classes/new-class-dialog";
import type { ClassRow, Person } from "@/components/admin/classes/types";

const WEEK = 7 * DAY_MS;

export default function ClassesPage() {
  const { can, me } = useStaff();
  const [weekOffset, setWeekOffset] = useState(0);
  const [mineOnly, setMineOnly] = useState<boolean | null>(null);
  const mine = mineOnly ?? (me ? ownClassesOnly(me) : false);
  // Rounded to the hour so the URL (and the fetch) doesn't change every render.
  const from = new Date(Math.floor((Date.now() - DAY_MS + weekOffset * WEEK) / HOUR_MS) * HOUR_MS);
  const to = new Date(from.getTime() + WEEK + 24 * 60 * 60 * 1000);
  const classes = useResource<ClassRow[]>(me ? `/api/classes?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}${mine ? "&mine=1" : ""}` : null);
  const members = useResource<{ items: Person[] }>(can("bookings.manage") ? "/api/members?status=ACTIVE&take=500&sort=name" : null);
  const staffList = useResource<{ id: string; name: string; roleName: string }[]>(can("classes.manage") ? "/api/staff/directory" : null);
  const [newOpen, setNewOpen] = useState(false);

  const days = useMemo(() => {
    const groups = new Map<string, ClassRow[]>();
    for (const c of classes.data ?? []) {
      const key = localDateIn(gym.business.timezone, new Date(c.startTime));
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return Array.from(groups.entries());
  }, [classes.data]);

  return (
    <>
      <PageHeader
        title="Classes"
        description="The week ahead, plus yesterday so you can still mark attendance."
        actions={
          <>
            <LinkButton href="/admin/classes/timetable" variant="secondary">
              Weekly timetable
            </LinkButton>
            {can("classes.manage") ? (
              <Button onClick={() => setNewOpen(true)}>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add one-off class
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </IconButton>
          <span className="min-w-[8rem] text-center font-medium" aria-live="polite">
            {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : weekOffset === -1 ? "Last week" : `${weekOffset > 0 ? "In" : ""} ${Math.abs(weekOffset)} weeks${weekOffset < 0 ? " ago" : ""}`.trim()}
          </span>
          <IconButton label="Next week" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
        <label className="flex min-h-tap items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-plate" checked={mine} onChange={(e) => setMineOnly(e.target.checked)} />
          Only classes I&apos;m training
        </label>
      </div>
      <AsyncBlock loading={classes.loading} error={classes.error} data={classes.data} onRetry={classes.reload} loadingLabel="Loading classes">
        {() =>
          days.length === 0 ? (
            <EmptyState title={mine ? "You're not training any classes this week" : "No classes this week"} action={can("classes.manage") ? <Link href="/admin/classes/timetable" className="font-medium text-plate underline underline-offset-2">Set up the weekly timetable</Link> : undefined} />
          ) : (
            <div className="space-y-6">
              {days.map(([key, rows]) => (
                <Panel key={key} aria-label={fmtDayHeading(rows[0].startTime)}>
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <h2 className="text-lg">{fmtDayHeading(rows[0].startTime)}</h2>
                    {rows.some((r) => r.bookings.length >= r.capacity) ? <StatusTag tone="warn">Some classes full</StatusTag> : null}
                  </div>
                  <ul>
                    {rows.map((cls) => (
                      <ClassCard key={cls.id} cls={cls} members={members.data?.items ?? []} onChange={classes.reload} />
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )
        }
      </AsyncBlock>
      <NewClassDialog open={newOpen} onClose={() => setNewOpen(false)} onSaved={classes.reload} trainers={staffList.data ?? []} />
    </>
  );
}
