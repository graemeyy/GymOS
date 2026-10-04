"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { addCalendarDays, zonedTimeToUtc } from "@/lib/dates";
import { gym } from "@/lib/config/client";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, PageHeader, Panel } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { DataList } from "@/components/ui/data-list";

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  staff: { id: string; name: string; role: string };
}
interface StaffRow {
  id: string;
  name: string;
}

export default function ShiftsPage() {
  const { can } = useStaff();
  const toast = useToast();
  const shifts = useResource<Shift[]>("/api/shifts");
  const staff = useResource<StaffRow[]>(can("classes.manage") ? "/api/staff/directory" : null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ staffId: "", date: "", start: "06:00", end: "14:00", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  // Removing a shift asks first and is sent once (R-57).
  const [removing, setRemoving] = useState<Shift | null>(null);

  const add = useMutation((body: Record<string, unknown>) => api("/api/shifts", { body }), {
    onSuccess: () => {
      toast("Shift added");
      setOpen(false);
      void shifts.reload();
    },
    onError: (e) => {
      setErrors(e.fields);
      setMessage(e.message);
    },
  });

  const remove = useMutation((shift: Shift) => api(`/api/shifts/${shift.id}`, { method: "DELETE" }), {
    onSuccess: () => {
      toast("Shift removed");
      void shifts.reload();
      setRemoving(null);
    },
    onError: (e) => {
      toast(e.message, "bad");
      setRemoving(null);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.date) return setErrors({ startTime: "Choose a date" });
    setErrors({});
    setMessage(null);
    const tz = gym.business.timezone;
    const startTime = zonedTimeToUtc(form.date, form.start, tz);
    let endTime = zonedTimeToUtc(form.date, form.end, tz);
    // Overnight shift: the finish time on the next calendar day, not 24 hours
    // later, which is an hour out when daylight saving changes (R-109).
    if (endTime <= startTime) endTime = zonedTimeToUtc(addCalendarDays(form.date, 1), form.end, tz);
    void add.run({ staffId: form.staffId, startTime: startTime.toISOString(), endTime: endTime.toISOString(), notes: form.notes || null });
  };

  return (
    <>
      <PageHeader
        title="Shifts"
        description="Who's rostered on, from now."
        actions={
          can("classes.manage") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add shift
            </Button>
          ) : undefined
        }
      />
      <Panel>
        <AsyncBlock loading={shifts.loading} error={shifts.error} data={shifts.data} onRetry={shifts.reload}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Nobody rostered on yet" />
              </div>
            ) : (
              <DataList
                caption="Upcoming shifts"
                rows={rows}
                rowKey={(s) => s.id}
                columns={[
                  { header: "Staff", primary: true, cell: (s) => <span className="font-medium">{s.staff.name}</span> },
                  { header: "Role", cell: (s) => s.staff.role },
                  { header: "When", cell: (s) => <span className="tabular">{fmtDateTime(s.startTime)} to {fmtTime(s.endTime)}</span> },
                  { header: "Notes", cell: (s) => s.notes ?? <span className="text-ink-soft">None</span> },
                ]}
                actions={
                  can("classes.manage")
                    ? (s) => (
                        <IconButton label={`Remove ${s.staff.name}'s shift`} onClick={() => setRemoving(s)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )
                    : undefined
                }
              />
            )
          }
        </AsyncBlock>
      </Panel>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a shift"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="shift-form" busy={add.busy}>
              Add shift
            </Button>
          </>
        }
      >
        <form id="shift-form" onSubmit={submit} className="space-y-4" noValidate>
          <SelectField label="Staff member" required value={form.staffId} error={errors.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} data-autofocus>
            <option value="">Choose someone</option>
            {staff.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <TextField label="Date" type="date" required value={form.date} error={errors.startTime} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Start" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <TextField label="Finish" type="time" value={form.end} error={errors.endTime} hint="Earlier than start means overnight." onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </div>
          <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {message ? <FormMessage>{message}</FormMessage> : null}
        </form>
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove.run(removing)}
        busy={remove.busy}
        title={removing ? `Remove ${removing.staff.name}'s shift?` : "Remove this shift?"}
        confirmLabel="Remove shift"
        body={removing ? `${fmtDateTime(removing.startTime)} to ${fmtTime(removing.endTime)}.` : ""}
      />
    </>
  );
}
