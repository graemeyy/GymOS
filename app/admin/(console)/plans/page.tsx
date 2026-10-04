"use client";

import React, { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { formatPlanPrice, INTERVAL_LABELS, parseDollarsToCents, type Interval } from "@/lib/money";
import { gym } from "@/lib/config/client";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField, TextareaField } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { DataList } from "@/components/ui/data-list";
import { planPerks } from "@/lib/plans/perks";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: Interval;
  active: boolean;
  classCreditsPerCycle: number | null;
  guestPassesPerCycle: number;
  shopDiscountPercent: number;
  guestRateCents: number;
  // null when the viewer can't see revenue.
  memberCount: number | null;
}

const blank = { name: "", description: "", price: "", interval: "WEEK" as Interval, active: true, unlimited: false, classes: "0", guestPasses: "0", discount: "0", guestRate: "" };

const benefitsText = (p: Plan) => planPerks(p, p.interval, { includeGuestRate: true }).join(", ");

export default function PlansPage() {
  const { can } = useStaff();
  const toast = useToast();
  const canEdit = can("plans:manage");
  const plans = useResource<Plan[]>("/api/admin/plans");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const save = useMutation(
    (target: Plan | null, body: Record<string, unknown>) => api(target ? `/api/plans/${target.id}` : "/api/admin/plans", { method: target ? "PUT" : "POST", body }),
    {
      onSuccess: (_result, target) => {
        toast(target ? "Plan saved" : "Plan created");
        setOpen(false);
        void plans.reload();
      },
      onError: (e) => {
        setErrors(e.fields);
        setMessage(e.message);
      },
    }
  );

  const openForm = (p: Plan | null) => {
    setEditing(p);
    setErrors({});
    setMessage(null);
    setForm(
      p
        ? {
            name: p.name,
            description: p.description ?? "",
            price: (p.priceCents / 100).toFixed(2),
            interval: p.interval,
            active: p.active,
            unlimited: p.classCreditsPerCycle === null,
            classes: String(p.classCreditsPerCycle ?? 0),
            guestPasses: String(p.guestPassesPerCycle),
            discount: String(p.shopDiscountPercent),
            guestRate: p.guestRateCents ? (p.guestRateCents / 100).toFixed(2) : "",
          }
        : blank
    );
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const priceCents = parseDollarsToCents(form.price);
    const guestRateCents = form.guestRate.trim() ? parseDollarsToCents(form.guestRate) : 0;
    const fieldErrors: Record<string, string> = {};
    if (priceCents === null || priceCents === 0) fieldErrors.priceCents = "Enter a price like 29.95";
    if (guestRateCents === null) fieldErrors.guestRateCents = "Enter an amount like 20.00";
    if (Object.keys(fieldErrors).length) return setErrors(fieldErrors);
    setErrors({});
    setMessage(null);
    const body = {
      name: form.name,
      description: form.description || null,
      priceCents,
      interval: form.interval,
      active: form.active,
      classCreditsPerCycle: form.unlimited ? null : Number(form.classes) || 0,
      guestPassesPerCycle: Number(form.guestPasses) || 0,
      shopDiscountPercent: Number(form.discount) || 0,
      guestRateCents,
    };
    void save.run(editing, body);
  };

  return (
    <>
      <PageHeader
        title="Plans"
        description="Membership tiers, prices and what's included. Prices include GST."
        actions={
          canEdit ? (
            <Button onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> New plan
            </Button>
          ) : undefined
        }
      />
      <Panel>
        <AsyncBlock loading={plans.loading} error={plans.error} data={plans.data} onRetry={plans.reload}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No plans yet" action={canEdit ? <Button onClick={() => openForm(null)}>Create the first plan</Button> : undefined} />
              </div>
            ) : (
              <DataList
                caption="Plans"
                rows={rows}
                rowKey={(p) => p.id}
                columns={[
                  {
                    header: "Plan",
                    primary: true,
                    cell: (p) => (
                      <div>
                        <p className="font-medium">
                          {p.name} {!p.active ? <StatusTag>Retired</StatusTag> : null}
                        </p>
                        <p className="text-sm text-ink-soft">{benefitsText(p)}</p>
                      </div>
                    ),
                  },
                  { header: "Price", cell: (p) => <span className="tabular">{formatPlanPrice(p.priceCents, p.interval)}</span> },
                  { header: "Members", align: "right", cell: (p) => <span className="tabular">{p.memberCount ?? "Hidden"}</span> },
                ]}
                actions={
                  canEdit
                    ? (p) => (
                        <IconButton label={`Edit ${p.name}`} onClick={() => openForm(p)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )
                    : undefined
                }
              />
            )
          }
        </AsyncBlock>
      </Panel>
      <p className="mt-4 max-w-prose text-sm text-ink-soft">
        Plan changes follow the gym&apos;s rules: upgrades {gym.policies.planChanges.upgradeProration === "prorate_now" ? "start straight away with the difference charged pro rata" : "start at the next billing date"}, downgrades{" "}
        {gym.policies.planChanges.downgradeTiming === "immediate" ? "start straight away" : "start at the next billing date"}. Retired plans stay on existing members until they change.
      </p>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New plan"}
        description={editing && (editing.memberCount ?? 1) > 0 ? "A new price applies to new sign-ups. Give existing members written notice before their price goes up." : undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="plan-form" busy={save.busy}>
              {editing ? "Save plan" : "Create plan"}
            </Button>
          </>
        }
      >
        <form id="plan-form" onSubmit={submit} className="space-y-4" noValidate>
          <TextField label="Name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          <TextareaField label="What's included" rows={2} value={form.description} error={errors.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Price incl. GST (AUD)" inputMode="decimal" value={form.price} error={errors.priceCents} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <SelectField label="Billed" value={form.interval} error={errors.interval} onChange={(e) => setForm({ ...form, interval: e.target.value as Interval })}>
              {(Object.keys(INTERVAL_LABELS) as Interval[]).map((i) => (
                <option key={i} value={i}>
                  {INTERVAL_LABELS[i].adverb[0].toUpperCase() + INTERVAL_LABELS[i].adverb.slice(1)}
                </option>
              ))}
            </SelectField>
          </div>
          <fieldset className="space-y-3 rounded border border-line p-4">
            <legend className="px-1 text-sm font-medium">Benefits per billing cycle</legend>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-plate" checked={form.unlimited} onChange={(e) => setForm({ ...form, unlimited: e.target.checked })} />
              Unlimited classes
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {!form.unlimited ? (
                <TextField label="Classes included" type="number" inputMode="numeric" min={0} value={form.classes} error={errors.classCreditsPerCycle} onChange={(e) => setForm({ ...form, classes: e.target.value })} />
              ) : null}
              <TextField label="Guest passes" type="number" inputMode="numeric" min={0} value={form.guestPasses} error={errors.guestPassesPerCycle} onChange={(e) => setForm({ ...form, guestPasses: e.target.value })} />
              <TextField label="Shop discount (%)" type="number" inputMode="numeric" min={0} max={100} value={form.discount} error={errors.shopDiscountPercent} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
              <TextField label="Guest visit rate (AUD)" inputMode="decimal" value={form.guestRate} error={errors.guestRateCents} hint="What a guest pays without a pass." onChange={(e) => setForm({ ...form, guestRate: e.target.value })} />
            </div>
          </fieldset>
          <Switch label="Available for new sign-ups" description="Turn off to retire the plan. Members already on it keep it." checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          {message ? <FormMessage>{message}</FormMessage> : null}
        </form>
      </Dialog>
    </>
  );
}
