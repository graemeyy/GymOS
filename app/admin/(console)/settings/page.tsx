"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { gym, formatAddress } from "@/lib/config";
import { formatAud, INTERVAL_LABELS, parseDollarsToCents } from "@/lib/money";
import { ROLE_LABELS, STAFF_ROLES, type StaffRoleName } from "@/lib/auth/permissions";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  interval: keyof typeof INTERVAL_LABELS;
}
interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: StaffRoleName;
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
          {p.pause.feeCents ? `, ${formatAud(p.pause.feeCents)} fee` : ", no fee"}
        </Row>
        <Row label="Failed payments">
          Reminders on days {p.failedPayments.reminderDays.join(", ")}, access suspended after {p.failedPayments.suspendAccessAfterDays} days
        </Row>
      </dl>
    </Panel>
  );
}

function PlanPrices({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const plans = useResource<Plan[]>("/api/plans");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (plans.data) setValues(Object.fromEntries(plans.data.map((p) => [p.id, (p.priceCents / 100).toFixed(2)])));
  }, [plans.data]);

  const save = async (plan: Plan) => {
    const cents = parseDollarsToCents(values[plan.id] ?? "");
    if (cents === null) return setErrors({ ...errors, [plan.id]: "Enter an amount like 29.95" });
    setErrors({ ...errors, [plan.id]: "" });
    setBusy(plan.id);
    try {
      await api(`/api/plans/${plan.id}`, { method: "PUT", body: { priceCents: cents } });
      toast(`${plan.name} price saved`);
      void plans.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't save the price.", "bad");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel aria-labelledby="plans-heading">
      <PanelHeader id="plans-heading" title="Plan prices" />
      <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">Prices include GST. A new price applies to new sign-ups. Existing members must be given written notice before their price goes up.</p>
      <AsyncBlock loading={plans.loading} error={plans.error} data={plans.data} onRetry={plans.reload}>
        {(rows) => (
          <ul className="divide-y divide-line">
            {rows.map((plan) => (
              <li key={plan.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-end">
                <TextField
                  label={`${plan.name}, per ${INTERVAL_LABELS[plan.interval].noun} (AUD)`}
                  inputMode="decimal"
                  value={values[plan.id] ?? ""}
                  error={errors[plan.id] || undefined}
                  disabled={!canEdit}
                  onChange={(e) => setValues({ ...values, [plan.id]: e.target.value })}
                  wrapperClassName="flex-1"
                />
                {canEdit ? (
                  <Button variant="secondary" busy={busy === plan.id} onClick={() => save(plan)}>
                    Save price
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </Panel>
  );
}

function FeatureSwitches({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const settings = useResource<{ requireKeycardForEntry: boolean; hideRevenueFromFrontDesk: boolean }>("/api/settings/features");
  const save = async (next: { requireKeycardForEntry: boolean; hideRevenueFromFrontDesk: boolean }) => {
    try {
      await api("/api/settings/features", { method: "PUT", body: next });
      toast("Setting saved");
      void settings.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't save the setting.", "bad");
    }
  };
  return (
    <Panel aria-labelledby="features-heading">
      <PanelHeader id="features-heading" title="Front desk" />
      <AsyncBlock loading={settings.loading} error={settings.error} data={settings.data} onRetry={settings.reload}>
        {(s) => (
          <div className="divide-y divide-line px-4">
            <Switch label="Require a keycard to enter" description="Members without an issued keycard are refused at the door." checked={s.requireKeycardForEntry} disabled={!canEdit} onChange={(v) => save({ ...s, requireKeycardForEntry: v })} />
            <Switch label="Hide revenue from front desk" description="Front-desk staff won't see revenue figures or payment history." checked={s.hideRevenueFromFrontDesk} disabled={!canEdit} onChange={(v) => save({ ...s, hideRevenueFromFrontDesk: v })} />
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
  const { can, loading } = useStaff();
  if (loading) return <PageHeader title="Settings" />;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <GymDetails />
        <PlanPrices canEdit={can("plans:manage")} />
        <FeatureSwitches canEdit={can("settings:manage")} />
        {can("staff:manage") ? <StaffAccounts /> : null}
      </div>
    </>
  );
}
