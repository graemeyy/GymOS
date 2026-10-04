"use client";

import React, { useMemo, useState } from "react";
import { CalendarPlus, Trash2, Users } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { zonedTimeToUtc } from "@/lib/dates";
import { gym } from "@/lib/config";
import { fmtTime } from "@/lib/client/format";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";

interface Person {
  id: string;
  name: string | null;
  email: string;
}
interface ClassRow {
  id: string;
  name: string;
  instructor: string | null;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  bookings: { id: string; memberId: string; status: "BOOKED" | "ATTENDED" | "NO_SHOW"; member: Person }[];
  waitlist: { id: string; memberId: string; member: Person }[];
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: gym.business.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-AU", { timeZone: gym.business.timezone, weekday: "long", day: "numeric", month: "long" });

function ClassCard({ cls, members, onChange }: { cls: ClassRow; members: Person[]; onChange: () => void }) {
  const { can } = useStaff();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const full = cls.bookings.length >= cls.capacity;
  const taken = new Set([...cls.bookings.map((b) => b.memberId), ...cls.waitlist.map((w) => w.memberId)]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast(success);
      onChange();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "That didn't work.", "bad");
    }
  };

  const addMember = () =>
    memberId &&
    run(
      () => api(`/api/classes/${cls.id}/${full ? "waitlist" : "book"}`, { body: { memberId } }).then(() => setMemberId("")),
      full ? "Added to the waitlist" : "Booked in"
    );

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="tabular w-16 shrink-0 font-display text-xl font-semibold">{fmtTime(cls.startTime)}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{cls.name}</p>
          <p className="text-sm text-ink-soft">
            {cls.durationMinutes} min{cls.instructor ? `, ${cls.instructor}` : ""}
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
                          onClick={() => run(() => api(`/api/classes/${cls.id}/book`, { method: "PATCH", body: { memberId: b.memberId, status: b.status === "ATTENDED" ? "BOOKED" : "ATTENDED" } }), "Attendance saved")}
                        >
                          Attended
                        </Button>
                        <Button
                          variant={b.status === "NO_SHOW" ? "danger" : "ghost"}
                          aria-pressed={b.status === "NO_SHOW"}
                          onClick={() => run(() => api(`/api/classes/${cls.id}/book`, { method: "PATCH", body: { memberId: b.memberId, status: b.status === "NO_SHOW" ? "BOOKED" : "NO_SHOW" } }), "Attendance saved")}
                        >
                          No-show
                        </Button>
                      </>
                    ) : null}
                    {can("classes:book") ? (
                      <Button variant="ghost" onClick={() => run(() => api(`/api/classes/${cls.id}/book?memberId=${encodeURIComponent(b.memberId)}`, { method: "DELETE" }), "Booking cancelled")}>
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
                        <Button variant="secondary" disabled={full} onClick={() => run(() => api(`/api/classes/${cls.id}/waitlist/promote`, { body: { memberId: w.memberId } }), "Moved into the class")}>
                          Book in
                        </Button>
                        <Button variant="ghost" onClick={() => run(() => api(`/api/classes/${cls.id}/waitlist?memberId=${encodeURIComponent(w.memberId)}`, { method: "DELETE" }), "Removed from waitlist")}>
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
              <Button variant="secondary" disabled={!memberId} onClick={addMember}>
                {full ? "Add to waitlist" : "Book in"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => run(() => api(`/api/classes/${cls.id}`, { method: "DELETE" }), "Class cancelled").then(() => setConfirmCancel(false))}
        title={`Cancel ${cls.name}?`}
        confirmLabel="Cancel class"
        body={`${cls.bookings.length} booking(s) and ${cls.waitlist.length} waitlist place(s) will be removed. Let those members know.`}
      />
    </li>
  );
}

function NewClassDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", instructor: "", date: "", time: "06:00", durationMinutes: "45", capacity: "16" });
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
          instructor: form.instructor || null,
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
        <TextField label="Trainer" value={form.instructor} error={errors.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
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

export default function ClassesPage() {
  const { can } = useStaff();
  const classes = useResource<ClassRow[]>("/api/classes");
  const members = useResource<{ items: Person[] }>(can("classes:book") ? "/api/members?status=ACTIVE&take=500" : null);
  const [newOpen, setNewOpen] = useState(false);

  const days = useMemo(() => {
    const groups = new Map<string, ClassRow[]>();
    for (const c of classes.data ?? []) {
      const key = dayKey.format(new Date(c.startTime));
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return Array.from(groups.entries());
  }, [classes.data]);

  return (
    <>
      <PageHeader
        title="Classes"
        description="Upcoming classes, plus anything from the last day so you can mark attendance."
        actions={
          can("classes:manage") ? (
            <Button onClick={() => setNewOpen(true)}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add class
            </Button>
          ) : undefined
        }
      />
      <AsyncBlock loading={classes.loading} error={classes.error} data={classes.data} onRetry={classes.reload} loadingLabel="Loading classes">
        {() =>
          days.length === 0 ? (
            <EmptyState title="No classes scheduled" action={can("classes:manage") ? <Button onClick={() => setNewOpen(true)}>Add a class</Button> : undefined} />
          ) : (
            <div className="space-y-6">
              {days.map(([key, rows]) => (
                <Panel key={key} aria-label={dayLabel.format(new Date(rows[0].startTime))}>
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <h2 className="text-lg">{dayLabel.format(new Date(rows[0].startTime))}</h2>
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
      <NewClassDialog open={newOpen} onClose={() => setNewOpen(false)} onSaved={classes.reload} />
    </>
  );
}
