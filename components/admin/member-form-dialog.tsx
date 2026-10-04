"use client";

import React, { useEffect, useRef, useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { STATUS_TEXT, type MemberStatus } from "@/lib/members/labels";
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
  membershipPlan?: { id: string; name: string } | null;
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
  // planId null means "not chosen yet": the default comes from the plans
  // list, which may arrive after the dialog opens.
  const [form, setForm] = useState({ name: "", email: "", planId: null as string | null, status: "ACTIVE" as MemberStatus });
  const save = useMutation(
    (target: EditableMember | null, body: Record<string, unknown>) => (target ? api(`/api/members/${target.id}`, { method: "PUT", body }) : api("/api/members", { body })),
    {
      onSuccess: (_result, target) => {
        toast(target ? "Member updated" : "Member added");
        onSaved();
        onClose();
      },
    }
  );
  const resetSave = save.reset;

  // Reset only when the dialog opens, not whenever the parent re-renders or
  // the plans list arrives, which wiped what staff had typed (R-56).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      resetSave();
      setForm({ name: member?.name ?? "", email: member?.email ?? "", planId: member ? (member.planId ?? "") : null, status: member?.status ?? "ACTIVE" });
    }
    wasOpen.current = open;
  }, [open, member, resetSave]);

  const planId = form.planId ?? plans[0]?.id ?? "";
  // A member on a retired plan keeps it in the list instead of showing
  // "No plan" (R-56).
  const currentPlan = member?.membershipPlan && !plans.some((p) => p.id === member.membershipPlan?.id) ? member.membershipPlan : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (member) {
      const body: Record<string, unknown> = { name: form.name, email: form.email };
      if (canBilling) {
        body.planId = planId || null;
        body.status = form.status;
      }
      void save.run(member, body);
    } else {
      void save.run(null, { name: form.name, email: form.email, planId: planId || null });
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
          <Button type="submit" form="member-form" busy={save.busy}>
            {member ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Full name" autoComplete="off" required value={form.name} error={save.fields.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
        <TextField label="Email" type="email" autoComplete="off" required value={form.email} error={save.fields.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Plan"
            value={planId}
            error={save.fields.planId}
            disabled={Boolean(member) && !canBilling}
            hint={member && !canBilling ? "A manager can change the plan." : undefined}
            onChange={(e) => setForm({ ...form, planId: e.target.value })}
          >
            <option value="">No plan</option>
            {currentPlan ? <option value={currentPlan.id}>{currentPlan.name} (retired)</option> : null}
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
              error={save.fields.status}
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
        {save.error ? <FormMessage>{save.error}</FormMessage> : null}
      </form>
    </Dialog>
  );
}
