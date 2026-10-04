"use client";

import React, { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { localDateIn, zonedTimeToUtc } from "@/lib/dates";
import { gym } from "@/lib/config/client";
import { fmtDayHeading, fmtTime } from "@/lib/format";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, LinkButton, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { DAY_MS, HOUR_MS } from "@/lib/time";

interface Person {
  id: string;
  name: string | null;
  email: string;
}
interface ClassRow {
  id: string;
  name: string;
  instructor: string | null;
  trainer: { id: string; name: string } | null;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  bookings: { id: string; memberId: string; status: "BOOKED" | "ATTENDED" | "NO_SHOW"; member: Person }[];
  waitlist: { id: string; memberId: string; member: Person }[];
}


function ClassCard({ cls, members, onChange }: { cls: ClassRow; members: Person[]; onChange: () => void }) {
  const { can } = useStaff();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [casual, setCasual] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const full = cls.bookings.length >= cls.capacity;
  const taken = new Set([...cls.bookings.map((b) => b.memberId), ...cls.waitlist.map((w) => w.memberId)]);

  // One change at a time per class: while one is being sent the class's
  // buttons are disabled, so a double tap can't send it twice (R-57).
  const [pending, setPending] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    if (pending) return;
    setPending(key);
    try {
      await fn();
      toast(success);
      onChange();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "That didn't work.", "bad");
    } finally {
      setPending(null);
    }
  };
  const busy = (key: string) => ({ busy: pending === key, disabled: pending !== null && pending !== key });

  const addMember = () =>
    memberId &&
    run(
      "add",
      () => api(`/api/classes/${cls.id}/${full ? "waitlist" : "book"}`, { body: full ? { memberId } : { memberId, casual } }).then(() => {
        setMemberId("");
        setCasual(false);
      }),
      full ? "Added to the waitlist" : "Booked in"
    );

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="tabular w-16 shrink-0 font-display text-xl font-semibold">{fmtTime(cls.startTime)}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{cls.name}</p>
          <p className="text-sm text-ink-soft">
            {cls.durationMinutes} min{cls.trainer?.name ?? cls.instructor ? `, ${cls.trainer?.name ?? cls.instructor}` : ""}
          </p>
        </div>
        <span className={full ? "text-sm font-medium text-warn" : "text-sm text-ink-soft"}>
          <span className="tabular">{cls.bookings.length}</span>/{cls.capacity}
          {cls.waitlist.length ? `, ${cls.waitlist.length} waiting` : ""}
        </span>
        <IconButton label={open ? `Hide roster for ${cls.name}` : `Show roster for ${cls.name}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          <Users className="h-[18px] w-[18px]" aria-hidden="true" />
        </IconButton>
        {can("classes:manage") ? (
          <IconButton label={`Cancel ${cls.name}`} onClick={() => setConfirmCancel(true)}>
            <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-4 border-t border-line bg-floor/50 px-4 py-4">
          {cls.bookings.length === 0 ? (
            <p className="text-sm text-ink-soft">No one booked yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded border border-line bg-surface">
              {cls.bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{b.member.name ?? b.member.email}</span>
                  <div className="flex items-center gap-1">
                    {can("classes:attendance") ? (
                      <>
                        <Button
                          variant={b.status === "ATTENDED" ? "primary" : "secondary"}
                          aria-pressed={b.status === "ATTENDED"}
                          {...busy(`attended-${b.id}`)}
                          onClick={() => run(`attended-${b.id}`, () => api(`/api/classes/${cls.id}/book`, { method: "PATCH", body: { memberId: b.memberId, status: b.status === "ATTENDED" ? "BOOKED" : "ATTENDED" } }), "Attendance saved")}
                        >
                          Attended
                        </Button>
                        <Button
                          variant={b.status === "NO_SHOW" ? "danger" : "ghost"}
                          aria-pressed={b.status === "NO_SHOW"}
                          {...busy(`no-show-${b.id}`)}
                          onClick={() => run(`no-show-${b.id}`, () => api(`/api/classes/${cls.id}/book`, { method: "PATCH", body: { memberId: b.memberId, status: b.status === "NO_SHOW" ? "BOOKED" : "NO_SHOW" } }), "Attendance saved")}
                        >
                          No-show
                        </Button>
                      </>
                    ) : null}
                    {can("classes:book") ? (
                      <Button variant="ghost" {...busy(`remove-${b.id}`)} onClick={() => run(`remove-${b.id}`, () => api(`/api/classes/${cls.id}/book?memberId=${encodeURIComponent(b.memberId)}`, { method: "DELETE" }), "Booking cancelled")}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cls.waitlist.length > 0 ? (
            <div>
              <p className="mb-1 text-sm font-medium">Waitlist, in order</p>
              <ol className="divide-y divide-line rounded border border-line bg-surface">
                {cls.waitlist.map((w, i) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="tabular mr-2 text-ink-soft">{i + 1}.</span>
                      {w.member.name ?? w.member.email}
                    </span>
                    {can("classes:book") ? (
                      <div className="flex gap-1">
                        <Button variant="secondary" busy={pending === `promote-${w.id}`} disabled={full || (pending !== null && pending !== `promote-${w.id}`)} onClick={() => run(`promote-${w.id}`, () => api(`/api/classes/${cls.id}/waitlist/promote`, { body: { memberId: w.memberId } }), "Moved into the class")}>
                          Book in
                        </Button>
                        <Button variant="ghost" {...busy(`unwait-${w.id}`)} onClick={() => run(`unwait-${w.id}`, () => api(`/api/classes/${cls.id}/waitlist?memberId=${encodeURIComponent(w.memberId)}`, { method: "DELETE" }), "Removed from waitlist")}>
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {can("classes:book") ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SelectField label={full ? "Add to waitlist" : "Book a member"} value={memberId} onChange={(e) => setMemberId(e.target.value)} wrapperClassName="flex-1">
                <option value="">Choose a member</option>
                {members
                  .filter((m) => !taken.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
              </SelectField>
              <Button variant="secondary" busy={pending === "add"} disabled={!memberId || (pending !== null && pending !== "add")} onClick={addMember}>
                {full ? "Add to waitlist" : "Book in"}
              </Button>
            </div>
          ) : null}
          {can("classes:book") && !full ? (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-plate" checked={casual} onChange={(e) => setCasual(e.target.checked)} />
              <span>Casual visit: don&apos;t use one of their class credits (they pay the casual rate at the desk)</span>
            </label>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => run("cancel", () => api(`/api/classes/${cls.id}`, { method: "DELETE" }), "Class cancelled").then(() => setConfirmCancel(false))}
        busy={pending === "cancel"}
        title={`Cancel ${cls.name}?`}
        confirmLabel="Cancel class"
        body={`${cls.bookings.length} booking(s) and ${cls.waitlist.length} waitlist place(s) will be removed. Let those members know.`}
      />
    </li>
  );
}

function NewClassDialog({ open, onClose, onSaved, trainers }: { open: boolean; onClose: () => void; onSaved: () => void; trainers: { id: string; name: string }[] }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", trainerId: "", date: "", time: "06:00", durationMinutes: "45", capacity: "16" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.date) {
      setErrors({ startTime: "Choose a date" });
      return;
    }
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await api("/api/classes", {
        body: {
          name: form.name,
          trainerId: form.trainerId || null,
          startTime: zonedTimeToUtc(form.date, form.time, gym.business.timezone).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          capacity: Number(form.capacity),
        },
      });
      toast("Class added");
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fields);
        setMessage(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a class"
      description={`Times are in the gym's timezone (${gym.business.timezone}).`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" busy={busy}>
            Add class
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Class name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
        <SelectField label="Trainer" value={form.trainerId} error={errors.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
          <option value="">No trainer yet</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Date" type="date" required value={form.date} error={errors.startTime} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextField label="Start time" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          <TextField label="Length (minutes)" type="number" inputMode="numeric" min={10} max={240} value={form.durationMinutes} error={errors.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          <TextField label="Places" type="number" inputMode="numeric" min={1} max={500} value={form.capacity} error={errors.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </div>
        {message ? <FormMessage>{message}</FormMessage> : null}
      </form>
    </Dialog>
  );
}

const WEEK = 7 * DAY_MS;

export default function ClassesPage() {
  const { can, me } = useStaff();
  const [weekOffset, setWeekOffset] = useState(0);
  const [mineOnly, setMineOnly] = useState<boolean | null>(null);
  const mine = mineOnly ?? me?.role === "TRAINER";
  // Rounded to the hour so the URL (and the fetch) doesn't change every render.
  const from = new Date(Math.floor((Date.now() - DAY_MS + weekOffset * WEEK) / HOUR_MS) * HOUR_MS);
  const to = new Date(from.getTime() + WEEK + 24 * 60 * 60 * 1000);
  const classes = useResource<ClassRow[]>(me ? `/api/classes?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}${mine ? "&mine=1" : ""}` : null);
  const members = useResource<{ items: Person[] }>(can("classes:book") ? "/api/members?status=ACTIVE&take=500" : null);
  const staffList = useResource<{ id: string; name: string; role: string }[]>(can("classes:manage") ? "/api/staff" : null);
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
            {can("classes:manage") ? (
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
            <EmptyState title={mine ? "You're not training any classes this week" : "No classes this week"} action={can("classes:manage") ? <Link href="/admin/classes/timetable" className="font-medium text-plate underline underline-offset-2">Set up the weekly timetable</Link> : undefined} />
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
      <NewClassDialog open={newOpen} onClose={() => setNewOpen(false)} onSaved={classes.reload} trainers={(staffList.data ?? []).filter((s) => s.role === "TRAINER" || s.role === "MANAGER" || s.role === "OWNER")} />
    </>
  );
}
