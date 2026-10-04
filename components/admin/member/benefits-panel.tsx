"use client";

import React, { useEffect, useState } from "react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { formatAud, parseDollarsToCents } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { useStaff } from "@/components/admin/staff-session";

interface Balance {
  allowance: number | null;
  adjustments: number;
  used: number;
  remaining: number | null;
}
interface Usage {
  cycle: { start: string; end: string } | null;
  classCredits: Balance;
  guestPasses: Balance;
  accountCreditCents: number;
  history: { id: string; kind: "CLASS_CREDIT" | "GUEST_PASS" | "ACCOUNT_CREDIT"; delta: number; reason: string; createdAt: string }[];
}

const KIND_TEXT = { CLASS_CREDIT: "Class credits", GUEST_PASS: "Guest passes", ACCOUNT_CREDIT: "Account credit" } as const;

function describe(b: Balance) {
  if (b.remaining === null) return "Unlimited";
  return `${b.remaining} left of ${(b.allowance ?? 0) + b.adjustments}`;
}

// `version` goes up when the membership changes elsewhere on the page (a
// new plan changes the allowance), so this panel reloads (R-55).
export function BenefitsPanel({ memberId, archived, version = 0 }: { memberId: string; archived: boolean; version?: number }) {
  const { can } = useStaff();
  const toast = useToast();
  const usage = useResource<Usage>(`/api/members/${memberId}/benefits`);
  const { reload } = usage;
  useEffect(() => {
    if (version > 0) void reload();
  }, [version, reload]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "CLASS_CREDIT" as keyof typeof KIND_TEXT, amount: "1", direction: "add", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const raw = form.kind === "ACCOUNT_CREDIT" ? parseDollarsToCents(form.amount) : Number.parseInt(form.amount, 10);
    if (raw === null || !Number.isFinite(raw) || raw <= 0) return setErrors({ delta: form.kind === "ACCOUNT_CREDIT" ? "Enter an amount like 20.00" : "Enter a whole number above zero" });
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await api(`/api/members/${memberId}/benefits`, { body: { kind: form.kind, delta: form.direction === "add" ? raw : -raw, reason: form.reason } });
      toast("Adjustment saved");
      setOpen(false);
      setForm({ ...form, amount: "1", reason: "" });
      void usage.reload();
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
    <Panel aria-labelledby="benefits-heading">
      <PanelHeader
        id="benefits-heading"
        title="Benefits this cycle"
        action={
          can("billing:manage") && !archived ? (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Adjust
            </Button>
          ) : undefined
        }
      />
      <AsyncBlock loading={usage.loading} error={usage.error} data={usage.data} onRetry={usage.reload}>
        {(u) => (
          <>
            <dl className="grid grid-cols-3 divide-x divide-line border-b border-line">
              <div className="px-4 py-3">
                <dt className="text-sm text-ink-soft">Classes</dt>
                <dd className="font-medium">{describe(u.classCredits)}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-sm text-ink-soft">Guest passes</dt>
                <dd className="font-medium">{describe(u.guestPasses)}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-sm text-ink-soft">Account credit</dt>
                <dd className="tabular font-medium">{formatAud(u.accountCreditCents)}</dd>
              </div>
            </dl>
            {u.cycle ? <p className="px-4 pt-3 text-sm text-ink-soft">Cycle {fmtDate(u.cycle.start)} to {fmtDate(u.cycle.end)}.</p> : null}
            {u.history.length > 0 ? (
              <ul className="divide-y divide-line">
                {u.history.slice(0, 8).map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>
                      {h.reason} <span className="text-ink-soft">({KIND_TEXT[h.kind]})</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className={`tabular font-medium ${h.delta > 0 ? "text-good" : "text-ink"}`}>
                        {h.delta > 0 ? "+" : "−"}
                        {h.kind === "ACCOUNT_CREDIT" ? formatAud(Math.abs(h.delta)) : Math.abs(h.delta)}
                      </span>
                      <span className="tabular text-ink-soft">{fmtDateTime(h.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-ink-soft">No adjustments or class bookings this cycle.</p>
            )}
          </>
        )}
      </AsyncBlock>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Adjust benefits"
        description="Every adjustment is recorded with your name and the reason."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button busy={busy} onClick={submit}>
              Save adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="What" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as keyof typeof KIND_TEXT, amount: e.target.value === "ACCOUNT_CREDIT" ? "10.00" : "1" })} data-autofocus>
              {Object.entries(KIND_TEXT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectField>
            <SelectField label="Add or remove" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </SelectField>
          </div>
          <TextField label={form.kind === "ACCOUNT_CREDIT" ? "Amount (AUD)" : "How many"} inputMode={form.kind === "ACCOUNT_CREDIT" ? "decimal" : "numeric"} value={form.amount} error={errors.delta} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <TextField label="Reason" value={form.reason} error={errors.reason} hint="For example: class cancelled by the gym." onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          {message ? <FormMessage>{message}</FormMessage> : null}
        </div>
      </Dialog>
    </Panel>
  );
}
