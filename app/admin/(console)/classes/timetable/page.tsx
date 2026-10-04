"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Slot {
  id: string;
  name: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  active: boolean;
  trainer: { id: string; name: string } | null;
}

const blank = { name: "", trainerId: "", weekday: "0", startTime: "06:00", durationMinutes: "45", capacity: "16", active: true };

function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
}

export default function TimetablePage() {
  const { can } = useStaff();
  const toast = useToast();
  const canEdit = can("classes:manage");
  const slots = useResource<Slot[]>("/api/class-templates");
  const staff = useResource<{ id: string; name: string; role: string }[]>(canEdit ? "/api/staff" : null);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Slot | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const openForm = (slot: Slot | null) => {
    setEditing(slot);
    setErrors({});
    setMessage(null);
    setForm(
      slot
        ? { name: slot.name, trainerId: slot.trainer?.id ?? "", weekday: String(slot.weekday), startTime: slot.startTime, durationMinutes: String(slot.durationMinutes), capacity: String(slot.capacity), active: slot.active }
        : blank
    );
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    const body = { name: form.name, trainerId: form.trainerId || null, weekday: Number(form.weekday), startTime: form.startTime, durationMinutes: Number(form.durationMinutes), capacity: Number(form.capacity), active: form.active };
    try {
      await api(editing ? `/api/class-templates/${editing.id}` : "/api/class-templates", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Slot saved" : "Slot added");
      setOpen(false);
      void slots.reload();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fields);
        setMessage(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api<{ created: number }>("/api/class-templates/generate", { body: { weeks: 2 } });
      toast(res.created ? `Added ${res.created} class${res.created === 1 ? "" : "es"} for the next two weeks` : "The next two weeks are already on the calendar");
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't add the classes.", "bad");
    } finally {
      setGenerating(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoveBusy(true);
    try {
      await api(`/api/class-templates/${deleting.id}`, { method: "DELETE" });
      toast("Slot removed");
      void slots.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't remove the slot.", "bad");
    } finally {
      setRemoveBusy(false);
      setDeleting(null);
    }
  };

  const byDay = DAYS.map((_, i) => (slots.data ?? []).filter((s) => s.weekday === i));

  return (
    <>
      <Link href="/admin/classes" className="mb-4 inline-flex min-h-tap items-center gap-2 rounded text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Classes
      </Link>
      <PageHeader
        title="Weekly timetable"
        description="The regular week. Classes are added to the calendar two weeks ahead, every night, and when you press the button."
        actions={
          canEdit ? (
            <>
              <Button variant="secondary" busy={generating} onClick={generate}>
                Add the next two weeks now
              </Button>
              <Button onClick={() => openForm(null)}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Add slot
              </Button>
            </>
          ) : undefined
        }
      />
      <AsyncBlock loading={slots.loading} error={slots.error} data={slots.data} onRetry={slots.reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No regular classes yet" action={canEdit ? <Button onClick={() => openForm(null)}>Add the first slot</Button> : undefined}>
              Add each class that runs every week, with its trainer.
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {DAYS.map((day, i) => (
                <Panel key={day} aria-labelledby={`day-${i}`}>
                  <PanelHeader id={`day-${i}`} title={day} />
                  {byDay[i].length === 0 ? (
                    <p className="px-4 py-3 text-sm text-ink-soft">No classes</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {byDay[i].map((s) => (
                        <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="tabular w-16 shrink-0 font-display text-lg font-semibold">{to12h(s.startTime)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{s.name}</span> {!s.active ? <StatusTag>Paused</StatusTag> : null}
                            <span className="block text-sm text-ink-soft">
                              {s.durationMinutes} min, {s.capacity} places{s.trainer ? `, ${s.trainer.name}` : ""}
                            </span>
                          </span>
                          {canEdit ? (
                            <span className="flex shrink-0">
                              <IconButton label={`Edit ${day} ${s.name}`} onClick={() => openForm(s)}>
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton label={`Remove ${day} ${s.name}`} onClick={() => setDeleting(s)}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </IconButton>
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              ))}
            </div>
          )
        }
      </AsyncBlock>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit slot" : "Add a weekly slot"}
        description="Changes apply to classes added from now on. Classes already on the calendar stay as they are."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="slot-form" busy={busy}>
              {editing ? "Save slot" : "Add slot"}
            </Button>
          </>
        }
      >
        <form id="slot-form" onSubmit={submit} className="space-y-4" noValidate>
          <TextField label="Class name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          <SelectField label="Trainer" value={form.trainerId} error={errors.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
            <option value="">No trainer yet</option>
            {(staff.data ?? [])
              .filter((s) => s.role !== "FRONT_DESK")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Day" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </SelectField>
            <TextField label="Start time" type="time" value={form.startTime} error={errors.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <TextField label="Length (minutes)" type="number" inputMode="numeric" value={form.durationMinutes} error={errors.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <TextField label="Places" type="number" inputMode="numeric" value={form.capacity} error={errors.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <Switch label="Running" description="Turn off to stop adding this class to the calendar." checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          {message ? <FormMessage>{message}</FormMessage> : null}
        </form>
      </Dialog>
      <ConfirmDialog open={Boolean(deleting)} onCancel={() => setDeleting(null)} onConfirm={remove} busy={removeBusy} title={`Remove ${deleting?.name ?? "this slot"}?`} confirmLabel="Remove slot" body="Classes already on the calendar stay. No new ones are added from this slot." />
    </>
  );
}
