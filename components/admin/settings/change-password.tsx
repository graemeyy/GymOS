"use client";

import React, { useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/form";

const EMPTY = { currentPassword: "", newPassword: "" };

export function ChangePassword() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const change = useMutation(() => api("/api/staff/me/password", { body: form }), {
    onSuccess: () => {
      toast("Password changed. You've been signed out on other devices.");
      setForm(EMPTY);
    },
  });
  // A refusal without field errors (wrong current password, too many tries)
  // is shown under the new password.
  const errors = Object.keys(change.fields).length ? change.fields : change.error ? { newPassword: change.error } : {};
  return (
    <Panel aria-labelledby="password-heading">
      <PanelHeader id="password-heading" title="Your password" />
      <form
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          void change.run();
        }}
        className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        noValidate
      >
        <TextField label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} error={errors.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." value={form.newPassword} error={errors.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        <Button type="submit" variant="secondary" busy={change.busy}>
          Change password
        </Button>
      </form>
    </Panel>
  );
}
