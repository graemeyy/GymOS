"use client";

import React, { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client/api";
import { STATUS_TEXT, type MemberStatus } from "@/lib/client/labels";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { useStaff } from "./staff-session";

export interface PlanOption {
  id: string;
  name: string;
}

export interface EditableMember {
  id: string;
  name: string | null;
  email: string;
  status: MemberStatus;
  planId: string | null;
  notes?: string | null;
  referredById?: string | null;
}

export function MemberFormDialog({
  open,
  member,
  plans,
  onClose,
  onSaved,
}: {
  open: boolean;
  member: EditableMember | null;
  plans: PlanOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can } = useStaff();
  const toast = useToast();
  const canBilling = can("billing:manage");
  const [form, setForm] = useState({ name: "", email: "", planId: "", status: "ACTIVE" as MemberStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setMessage(null);
    setForm({
      name: member?.name ?? "",
      email: member?.email ?? "",
      planId: member?.planId ?? plans[0]?.id ?? "",
      status: member?.status ?? "ACTIVE",
    });
  }, [open, member, plans]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      if (member) {
        const body: Record<string, unknown> = { name: form.name, email: form.email };
        if (canBilling) {
          body.planId = form.planId || null;
          body.status = form.status;
        }
        await api(`/api/members/${member.id}`, { method: "PUT", body });
        toast("Member updated");
      } else {
        await api("/api/members", { body: { name: form.name, email: form.email, planId: form.planId || null } });
        toast("Member added");
      }
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
      title={member ? "Edit member" : "Add member"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-form" busy={busy}>
            {member ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Full name" autoComplete="off" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
        <TextField label="Email" type="email" autoComplete="off" required value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Plan"
            value={form.planId}
            error={errors.planId}
            disabled={Boolean(member) && !canBilling}
            hint={member && !canBilling ? "A manager can change the plan." : undefined}
            onChange={(e) => setForm({ ...form, planId: e.target.value })}
          >
            <option value="">No plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          {member ? (
            <SelectField
              label="Status"
              value={form.status}
              error={errors.status}
              disabled={!canBilling}
              onChange={(e) => setForm({ ...form, status: e.target.value as MemberStatus })}
            >
              {(Object.keys(STATUS_TEXT) as MemberStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_TEXT[s]}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>
        {member && canBilling ? (
          <p className="text-sm text-ink-soft">Setting the plan or status here corrects the record only. To change a plan, pause or cancel with the gym&apos;s rules and Stripe kept in step, use the Membership panel.</p>
        ) : null}
        {message ? <FormMessage>{message}</FormMessage> : null}
      </form>
    </Dialog>
  );
}
