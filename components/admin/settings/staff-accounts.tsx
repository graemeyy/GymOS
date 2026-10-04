"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { ROLE_LABELS, STAFF_ROLES, type StaffRoleName } from "@/lib/auth/permissions";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: StaffRoleName;
}

const BLANK = { name: "", email: "", password: "", role: "FRONT_DESK" as StaffRoleName };

export function StaffAccounts() {
  const toast = useToast();
  const { me } = useStaff();
  const staff = useResource<StaffRow[]>("/api/staff");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [removing, setRemoving] = useState<StaffRow | null>(null);

  const create = useMutation(() => api("/api/staff", { body: form }), {
    onSuccess: () => {
      toast("Staff account created");
      setOpen(false);
      setForm(BLANK);
      void staff.reload();
    },
  });
  const changeRole = useMutation((row: StaffRow, role: StaffRoleName) => api(`/api/staff/${row.id}`, { method: "PUT", body: { role } }), {
    onSuccess: (_, row, role) => {
      toast(`${row.name} is now ${ROLE_LABELS[role].toLowerCase()}. They'll need to sign in again.`);
      void staff.reload();
    },
    // Reload either way, so the select shows the role that was actually saved.
    onError: (e) => {
      toast(e.message, "bad");
      void staff.reload();
    },
  });
  const remove = useMutation((row: StaffRow) => api(`/api/staff/${row.id}`, { method: "DELETE" }), {
    onSuccess: () => {
      toast("Staff account removed");
      void staff.reload();
    },
    onError: (e) => toast(e.message, "bad"),
  });

  return (
    <Panel aria-labelledby="staff-heading">
      <PanelHeader
        id="staff-heading"
        title="Staff accounts"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              create.reset();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add staff
          </Button>
        }
      />
      <AsyncBlock loading={staff.loading} error={staff.error} data={staff.data} onRetry={staff.reload}>
        {(rows) => (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.name}
                    {s.id === me?.id ? <span className="text-ink-soft"> (you)</span> : null}
                  </p>
                  <p className="truncate text-sm text-ink-soft">{s.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <label htmlFor={`role-${s.id}`} className="sr-only">
                    Role for {s.name}
                  </label>
                  <select
                    id={`role-${s.id}`}
                    value={s.role}
                    disabled={s.id === me?.id || changeRole.busy}
                    onChange={(e) => void changeRole.run(s, e.target.value as StaffRoleName)}
                    className="min-h-tap rounded border border-line-strong bg-surface px-3 text-sm disabled:bg-sunken"
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  {s.id !== me?.id ? (
                    <IconButton label={`Remove ${s.name}`} onClick={() => setRemoving(s)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a staff account"
        description="Share the temporary password in person. They can change it later."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" busy={create.busy}>
              Create account
            </Button>
          </>
        }
      >
        <form
          id="staff-form"
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            void create.run();
          }}
          className="space-y-4"
          noValidate
        >
          <TextField label="Full name" required value={form.name} error={create.fields.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          <TextField label="Email" type="email" required value={form.email} error={create.fields.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Temporary password" type="password" autoComplete="new-password" required hint="At least 10 characters." value={form.password} error={create.fields.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <SelectField label="Role" value={form.role} error={create.fields.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRoleName })}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
          {create.error ? <FormMessage>{create.error}</FormMessage> : null}
        </form>
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await remove.run(removing);
          setRemoving(null);
        }}
        busy={remove.busy}
        title={`Remove ${removing?.name ?? "this account"}?`}
        confirmLabel="Remove account"
        body="They're signed out straight away and can't sign in again. Their past actions stay in the audit log."
      />
    </Panel>
  );
}
