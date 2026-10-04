"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { fmtDate, invoiceNo } from "@/lib/format";
import { formatAud, formatPlanPrice } from "@/lib/money";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, TextareaField, TextField } from "@/components/ui/form";
import { useMe } from "@/components/member/member-shell";
import { gym } from "@/lib/config/client";
import { addCalendarDays, localDateIn } from "@/lib/dates";
import { MembershipLine } from "@/components/member/membership-summary";
import type { Interval } from "@/components/member/types";

interface PlanOption {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: Interval;
  current: boolean;
  pending: boolean;
  change: { upgrade: boolean; immediate: boolean; effectiveAt: string; prorationCents: number | null } | null;
}

interface Options {
  hasMembership: boolean;
  selfServe: boolean;
  plans: PlanOption[];
  cancellation: { allowed: boolean; scheduledFor: string | null; preview: { effectiveAt: string; reason: "cooling_off" | "notice" | "minimum_term" | "immediate" } | null; noticeDays: number; coolingOffDays: number; minimumTermWeeks: number };
  pause: { allowed: boolean; current: { from: string; until: string } | null; minDays: number; maxDays: number; maxPausesPerYear: number; pausesUsed: number; feeCents: number };
}

interface Payment {
  id: string;
  invoiceNumber: number;
  amount: number;
  refundedCents: number;
  description: string | null;
  paidAt: string;
  status: string;
}

// The gym's local date, not UTC (which is yesterday before 10 or 11am in
// Sydney) (R-13).
const today = () => localDateIn(gym.business.timezone);
const addDays = addCalendarDays;

function changeText(plan: PlanOption) {
  const c = plan.change!;
  if (!c.immediate) return `Changes on ${fmtDate(c.effectiveAt)}, your next billing date. You keep your current plan until then.`;
  if (c.prorationCents === null) return `Starts now. Stripe charges or credits the difference for the rest of this billing period, then ${formatPlanPrice(plan.priceCents, plan.interval)}.`;
  if (c.prorationCents > 0) return `Starts now. Stripe charges about ${formatAud(c.prorationCents)} for the rest of this billing period, then ${formatPlanPrice(plan.priceCents, plan.interval)}.`;
  return `Starts now. Then ${formatPlanPrice(plan.priceCents, plan.interval)}.`;
}

const CANCEL_RULE: Record<string, string> = {
  cooling_off: "You're within the cooling-off period, so it ends today and you won't be charged again.",
  notice: "This includes the gym's notice period.",
  minimum_term: "This is the end of your minimum term.",
  immediate: "It ends today.",
};

export default function MembershipPage() {
  const me = useMe();
  const options = useResource<Options>("/api/me/membership");
  const payments = useResource<Payment[]>("/api/me/payments");
  const toast = useToast();
  const [changeTo, setChangeTo] = useState<PlanOption | null>(null);
  const [pausing, setPausing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await Promise.all([options.reload(), me.reload()]);
  };

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      await refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "That didn't work. Try again.", "bad");
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/billing-portal", { method: "POST" });
      window.location.assign(url);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't open the card page.", "bad");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My membership" />
      {me.data ? <MembershipLine me={me.data} /> : null}

      <AsyncBlock loading={options.loading} error={options.error} data={options.data} onRetry={options.reload} loadingLabel="Loading your options">
        {(o) => (
          <>
            {!o.hasMembership ? (
              <EmptyState title="No active membership" action={<LinkButton href="/member/welcome">Choose a membership</LinkButton>}>
                Pick a plan to start training.
              </EmptyState>
            ) : null}

            {o.hasMembership ? (
              <Panel aria-labelledby="plans">
                <PanelHeader id="plans" title="Change plan" />
                {!o.selfServe ? <p className="border-b border-line px-4 py-3 text-sm text-ink-soft sm:px-5">Your membership is billed at the front desk, so plan changes are made there.</p> : null}
                <ul className="divide-y divide-line">
                  {o.plans.map((plan) => (
                    <li key={plan.id} className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div>
                        <p className="font-medium">
                          {plan.name}{" "}
                          <span className="tabular text-ink-soft">
                            {formatPlanPrice(plan.priceCents, plan.interval)}
                          </span>
                        </p>
                        {plan.description ? <p className="text-sm text-ink-soft">{plan.description}</p> : null}
                      </div>
                      {plan.current ? (
                        <StatusTag tone="good">Your plan</StatusTag>
                      ) : plan.pending ? (
                        <StatusTag tone="plate">Starts next billing date</StatusTag>
                      ) : o.selfServe && plan.change ? (
                        <Button variant="secondary" onClick={() => setChangeTo(plan)} aria-label={`${plan.change.upgrade ? "Upgrade" : "Switch"} to ${plan.name}`}>
                          {plan.change.upgrade ? "Upgrade" : "Switch"}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            {o.hasMembership ? (
              <Panel aria-labelledby="pause">
                <PanelHeader id="pause" title="Pause" />
                <div className="space-y-3 px-4 py-4 sm:px-5">
                  {o.pause.current ? (
                    <>
                      <p>
                        Paused from {fmtDate(o.pause.current.from)} to {fmtDate(o.pause.current.until)}.
                      </p>
                      <Button variant="secondary" busy={busy} onClick={() => run(() => api("/api/me/membership/pause", { method: "DELETE" }), "Welcome back. Your membership is active again.")}>
                        Resume now
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-ink-soft">
                        Pause for {o.pause.minDays} to {o.pause.maxDays} days, up to {o.pause.maxPausesPerYear} times a year. You&apos;ve used {o.pause.pausesUsed}.
                        {o.pause.feeCents > 0 ? ` A pause costs ${formatAud(o.pause.feeCents)}.` : " There's no charge to pause."}
                      </p>
                      {o.pause.allowed ? (
                        <Button variant="secondary" onClick={() => setPausing(true)}>
                          Pause my membership
                        </Button>
                      ) : (
                        <p className="text-sm text-ink-soft">Pausing isn&apos;t available right now. Ask at the front desk if you need a break.</p>
                      )}
                    </>
                  )}
                </div>
              </Panel>
            ) : null}

            {o.hasMembership ? (
              <Panel aria-labelledby="cancel">
                <PanelHeader id="cancel" title="Cancel" />
                <div className="space-y-3 px-4 py-4 sm:px-5">
                  {o.cancellation.scheduledFor ? (
                    <>
                      <p>Your membership ends on {fmtDate(o.cancellation.scheduledFor)}. Changed your mind?</p>
                      <Button variant="secondary" busy={busy} onClick={() => run(() => api("/api/me/membership/cancel", { method: "DELETE" }), "Cancellation withdrawn. Your membership continues.")}>
                        Keep my membership
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-ink-soft">
                        {o.cancellation.coolingOffDays > 0 ? `In your first ${o.cancellation.coolingOffDays} days you can cancel straight away. ` : ""}
                        After that, cancelling takes {o.cancellation.noticeDays} days&apos; notice
                        {o.cancellation.minimumTermWeeks > 0 ? `, and not before your ${o.cancellation.minimumTermWeeks}-week minimum term ends` : ""}. Your rights under Australian Consumer Law aren&apos;t affected.
                      </p>
                      {o.cancellation.allowed ? (
                        <Button variant="danger" onClick={() => setCancelling(true)}>
                          Cancel my membership
                        </Button>
                      ) : (
                        <p className="text-sm text-ink-soft">To cancel, talk to the front desk or email the gym.</p>
                      )}
                    </>
                  )}
                </div>
              </Panel>
            ) : null}

            {/* Mounted only while open, so each opening starts clean instead of
                showing the last attempt's error (R-90). */}
            {changeTo ? <ChangePlanDialog plan={changeTo} onClose={() => setChangeTo(null)} onDone={refresh} /> : null}
            {pausing ? <PauseDialog open options={o.pause} onClose={() => setPausing(false)} onDone={refresh} /> : null}
            {cancelling ? <CancelDialog open options={o.cancellation} onClose={() => setCancelling(false)} onDone={refresh} /> : null}
          </>
        )}
      </AsyncBlock>

      <Panel aria-labelledby="payments">
        <PanelHeader
          id="payments"
          title="Payments and invoices"
          action={
            me.data?.hasCardOnFile ? (
              <Button variant="ghost" onClick={openPortal} busy={busy}>
                Update card
              </Button>
            ) : null
          }
        />
        <AsyncBlock loading={payments.loading} error={payments.error} data={payments.data} onRetry={payments.reload}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No payments yet" />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <p className="font-medium">{p.description ?? "Payment"}</p>
                      <p className="text-sm text-ink-soft">
                        {fmtDate(p.paidAt)}, {formatAud(p.amount)}
                        {p.refundedCents > 0 ? `, ${formatAud(p.refundedCents)} refunded` : ""}
                      </p>
                    </div>
                    <Link href={`/member/invoice/${p.id}`} className="shrink-0 text-sm font-medium text-plate underline underline-offset-2">
                      Invoice {invoiceNo(p.invoiceNumber)}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        </AsyncBlock>
      </Panel>
    </div>
  );
}

function ChangePlanDialog({ plan, onClose, onDone }: { plan: PlanOption | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  if (!plan?.change) return null;
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ immediate: boolean; effectiveAt: string }>("/api/me/membership/plan", { body: { planId: plan.id } });
      toast(res.immediate ? `You're now on ${plan.name}.` : `${plan.name} starts on ${fmtDate(res.effectiveAt)}.`);
      onClose();
      await onDone();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${plan.change.upgrade ? "Upgrade" : "Switch"} to ${plan.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={confirm} busy={busy}>
            {plan.change.upgrade ? "Upgrade" : "Switch"} to {plan.name}
          </Button>
        </>
      }
    >
      <p>{changeText(plan)}</p>
      {error ? <div className="mt-3"><FormMessage>{error}</FormMessage></div> : null}
    </Dialog>
  );
}

function PauseDialog({ open, options, onClose, onDone }: { open: boolean; options: Options["pause"]; onClose: () => void; onDone: () => Promise<void> }) {
  const [from, setFrom] = useState(today());
  const [until, setUntil] = useState(addDays(today(), Math.max(options.minDays, 14)));
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const submit = async () => {
    setBusy(true);
    setFields({});
    setError(null);
    try {
      await api("/api/me/membership/pause", { body: { from, until } });
      toast(`Paused from ${fmtDate(from)} to ${fmtDate(until)}.`);
      onClose();
      await onDone();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setFields(e.fields);
        setError(e.message);
      } else setError("That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pause my membership"
      description={`Between ${options.minDays} and ${options.maxDays} days. You won't be charged while paused.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={submit} busy={busy}>
            Pause
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="From" type="date" min={today()} value={from} onChange={(e) => setFrom(e.target.value)} error={fields.from} />
        <TextField label="Until" type="date" min={addDays(from, options.minDays)} max={addDays(from, options.maxDays)} value={until} onChange={(e) => setUntil(e.target.value)} error={fields.until} />
      </div>
      {error && !Object.keys(fields).length ? <div className="mt-3"><FormMessage>{error}</FormMessage></div> : null}
    </Dialog>
  );
}

function CancelDialog({ open, options, onClose, onDone }: { open: boolean; options: Options["cancellation"]; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const preview = options.preview;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ effectiveAt: string; reason: string }>("/api/me/membership/cancel", { body: { reason: reason.trim() || undefined } });
      toast(res.reason === "cooling_off" ? "Your membership is cancelled." : `Your membership ends on ${fmtDate(res.effectiveAt)}.`);
      onClose();
      await onDone();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cancel my membership"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep my membership
          </Button>
          <Button variant="danger" onClick={submit} busy={busy}>
            Cancel membership
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {preview ? (
          <p>
            {preview.reason === "cooling_off" ? "" : `Your last day will be ${fmtDate(preview.effectiveAt)}. `}
            {CANCEL_RULE[preview.reason]}
            {preview.reason === "cooling_off" ? "" : " You can keep training until then."}
          </p>
        ) : null}
        <TextareaField label="Anything we could do better? (optional)" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>
    </Dialog>
  );
}
