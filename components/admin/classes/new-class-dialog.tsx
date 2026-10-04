"use client";

import React, { useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { zonedTimeToUtc } from "@/lib/dates";
import { gym } from "@/lib/config/client";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";

export function NewClassDialog({ open, onClose, onSaved, trainers }: { open: boolean; onClose: () => void; onSaved: () => void; trainers: { id: string; name: string }[] }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", trainerId: "", date: "", time: "06:00", durationMinutes: "45", capacity: "16" });
  const [dateError, setDateError] = useState<string | null>(null);
  const create = useMutation(
    () =>
      api("/api/classes", {
        body: {
          name: form.name,
          trainerId: form.trainerId || null,
          startTime: zonedTimeToUtc(form.date, form.time, gym.business.timezone).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          capacity: Number(form.capacity),
        },
      }),
    {
      onSuccess: () => {
        toast("Class added");
        onSaved();
        onClose();
      },
    }
  );
  const errors: Record<string, string> = dateError ? { startTime: dateError } : create.fields;
  const message = dateError ? null : create.error;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.date) return setDateError("Choose a date");
    setDateError(null);
    void create.run();
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
          <Button type="submit" form="class-form" busy={create.busy}>
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
