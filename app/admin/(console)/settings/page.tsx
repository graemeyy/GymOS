"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { gym, formatAddress } from "@/lib/config";
import { formatAud } from "@/lib/money";
import { can, ROLE_LABELS, STAFF_ROLES, type Permission, type StaffRoleName } from "@/lib/auth/permissions";
import { PERMISSION_TEXT } from "@/lib/auth/permission-text";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, LinkButton, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: StaffRoleName;
}

interface FeatureSettings {
  requireKeycardForEntry: boolean;
  hideRevenueFromFrontDesk: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function GymDetails() {
  const p = gym.policies;
  return (
    <Panel aria-labelledby="gym-heading">
      <PanelHeader id="gym-heading" title="Gym details and policies" />
      <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">
        These come from <code className="rounded bg-sunken px-1">config/gym.config.json</code>, so a new gym can be set up without code changes. Edit that file and redeploy to change them.
        {gym.isDemo ? " The current values are fictional demo details." : ""}
      </p>
      <dl className="divide-y divide-line">
        <Row label="Business">
          {gym.business.legalName}, ABN {gym.business.abn}
          {gym.business.gstRegistered ? ", registered for GST" : ", not registered for GST"}
        </Row>
        <Row label="Address">{formatAddress()}</Row>
        <Row label="Contact">
          {gym.business.phone}, {gym.business.email}
        </Row>
        <Row label="Timezone">{gym.business.timezone}</Row>
        <Row label="Cancellation">
          {p.cancellation.noticeDays} days&apos; notice
          {p.cancellation.minimumTermWeeks ? `, ${p.cancellation.minimumTermWeeks}-week minimum term` : ", no minimum term"}
          {p.cancellation.coolingOffDays ? `, ${p.cancellation.coolingOffDays}-day cooling-off period` : ""}
        </Row>
        <Row label="Pausing">
          {p.pause.allowMemberSelfPause ? "Members can pause themselves" : "Staff pause memberships"}, {p.pause.minDays} to {p.pause.maxDays} days, up to {p.pause.maxPausesPerYear} times a year
          {p.pause.feeCents ? `, ${formatAud(p.pause.feeCents)} fee (not charged automatically yet: collect it at the desk)` : ", no fee"}
        </Row>
        <Row label="Failed payments">
          Reminders on days {p.failedPayments.reminderDays.join(", ")}, access suspended after {p.failedPayments.suspendAccessAfterDays} days
        </Row>
      </dl>
    </Panel>
  );
}

function RolePermissions() {
  const groups: [string, Permission[]][] = [
    ["Members", ["members:read", "members:write", "members:archive"]],
    ["Money", ["revenue:view", "billing:manage", "billing:refund", "finance:view"]],
    ["Classes and check-in", ["classes:read", "classes:book", "classes:attendance", "classes:manage", "checkin:scan"]],
    ["Shop", ["orders:fulfil", "shop:manage", "inventory:adjust"]],
    ["Running the gym", ["plans:manage", "announcements:manage", "staff:manage", "audit:read", "settings:manage"]],
  ];
  return (
    <Panel aria-labelledby="roles-heading">
      <PanelHeader id="roles-heading" title="What each role can do" />
      {/* Focusable so keyboard users can scroll it sideways on a phone. */}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Permissions by role, scrollable">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th scope="col" className="px-4 py-2 font-medium">Permission</th>
              {STAFF_ROLES.map((r) => (
                <th key={r} scope="col" className="px-3 py-2 text-center font-medium">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(([group, perms]) => (
            <tbody key={group} className="border-b border-line last:border-0">
              <tr>
                <th scope="rowgroup" colSpan={5} className="bg-floor px-4 py-1.5 text-left text-xs font-medium text-ink-soft">
                  {group}
                </th>
              </tr>
              {perms.map((p) => (
                <tr key={p}>
                  <th scope="row" className="px-4 py-1.5 text-left font-normal">
                    {PERMISSION_TEXT[p]}
                  </th>
                  {STAFF_ROLES.map((r) => (
                    <td key={r} className="px-3 py-1.5 text-center">
                      {can(r, p) ? <span aria-label="Yes" className="font-medium text-good">Yes</span> : <span aria-label="No" className="text-ink-soft">No</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">Front desk can also be stopped from seeing revenue with the switch above. Trainers can only mark attendance for their own classes.</p>
    </Panel>
  );
}

function ChangePassword() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api("/api/staff/me/password", { body: form });
      toast("Password changed. You've been signed out on other devices.");
      setForm({ currentPassword: "", newPassword: "" });
    } catch (e) {
      if (e instanceof ApiClientError) setErrors({ ...e.fields, ...(Object.keys(e.fields).length ? {} : { newPassword: e.message }) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel aria-labelledby="password-heading">
      <PanelHeader id="password-heading" title="Your password" />
      <form onSubmit={submit} className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <TextField label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} error={errors.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." value={form.newPassword} error={errors.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        <Button type="submit" variant="secondary" busy={busy}>
          Change password
        </Button>
      </form>
    </Panel>
  );
}

function FeatureSwitches({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const settings = useResource<FeatureSettings>("/api/settings/features");
  const [saving, setSaving] = useState(false);
  // Sends only the changed field and locks the switches until it's saved, so
  // quick toggles can't overwrite each other (R-51).
  const save = async (change: Partial<FeatureSettings>) => {
    setSaving(true);
    try {
      await api("/api/settings/features", { method: "PUT", body: change });
      toast("Setting saved");
      await settings.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't save the setting.", "bad");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Panel aria-labelledby="features-heading">
      <PanelHeader id="features-heading" title="Front desk" />
      <AsyncBlock loading={settings.loading} error={settings.error} data={settings.data} onRetry={settings.reload}>
        {(s) => (
          <div className="divide-y divide-line px-4">
            <Switch label="Require a keycard to enter" description="Members without an issued keycard are refused at the door." checked={s.requireKeycardForEntry} disabled={!canEdit || saving} onChange={(v) => save({ requireKeycardForEntry: v })} />
            <Switch label="Hide revenue from front desk" description="Front-desk staff won't see revenue figures or payment history." checked={s.hideRevenueFromFrontDesk} disabled={!canEdit || saving} onChange={(v) => save({ hideRevenueFromFrontDesk: v })} />
          </div>
        )}
      </AsyncBlock>
    </Panel>
  );
}

function StaffAccounts() {
  const toast = useToast();
  const { me } = useStaff();
  const staff = useResource<StaffRow[]>("/api/staff");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "FRONT_DESK" as StaffRoleName });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<StaffRow | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await api("/api/staff", { body: form });
      toast("Staff account created");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "FRONT_DESK" });
      void staff.reload();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fields);
        setMessage(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (row: StaffRow, role: StaffRoleName) => {
    try {
      await api(`/api/staff/${row.id}`, { method: "PUT", body: { role } });
      toast(`${row.name} is now ${ROLE_LABELS[role].toLowerCase()}. They'll need to sign in again.`);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't change the role.", "bad");
    } finally {
      void staff.reload();
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await api(`/api/staff/${removing.id}`, { method: "DELETE" });
      toast("Staff account removed");
      void staff.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't remove the account.", "bad");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Panel aria-labelledby="staff-heading">
      <PanelHeader
        id="staff-heading"
        title="Staff accounts"
        action={
          <Button variant="secondary" onClick={() => setOpen(true)}>
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
                    disabled={s.id === me?.id}
                    onChange={(e) => changeRole(s, e.target.value as StaffRoleName)}
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
            <Button type="submit" form="staff-form" busy={busy}>
              Create account
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={create} className="space-y-4" noValidate>
          <TextField label="Full name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          <TextField label="Email" type="email" required value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Temporary password" type="password" autoComplete="new-password" required hint="At least 10 characters." value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <SelectField label="Role" value={form.role} error={errors.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRoleName })}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
          {message ? <FormMessage>{message}</FormMessage> : null}
        </form>
      </Dialog>
      <ConfirmDialog open={Boolean(removing)} onCancel={() => setRemoving(null)} onConfirm={remove} title={`Remove ${removing?.name ?? "this account"}?`} confirmLabel="Remove account" body="They're signed out straight away and can't sign in again. Their past actions stay in the audit log." />
    </Panel>
  );
}

export default function SettingsPage() {
  const { can: allowed, loading } = useStaff();
  if (loading) return <PageHeader title="Settings" />;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <GymDetails />
        <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg">Plans and prices</h2>
            <p className="text-sm text-ink-soft">Tiers, prices and benefits are managed on the Plans page.</p>
          </div>
          <LinkButton href="/admin/plans" variant="secondary">
            Open plans
          </LinkButton>
        </Panel>
        <FeatureSwitches canEdit={allowed("settings:manage")} />
        {allowed("staff:manage") ? <StaffAccounts /> : null}
        {allowed("staff:read") ? <RolePermissions /> : null}
        <ChangePassword />
      </div>
    </>
  );
}
