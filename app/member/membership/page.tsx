"use client";

import { useState } from "react";
import Link from "next/link";
import { api, useMutation, useResource } from "@/lib/client/api";
import { fmtDate, invoiceNo } from "@/lib/format";
import { formatAud, formatPlanPrice } from "@/lib/money";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { useMe } from "@/components/member/member-shell";
import { MembershipLine } from "@/components/member/membership-summary";
import { CancelDialog } from "@/components/member/membership/cancel-dialog";
import { ChangePlanDialog } from "@/components/member/membership/change-plan-dialog";
import { PauseDialog } from "@/components/member/membership/pause-dialog";
import type { Options, Payment, PlanOption } from "@/components/member/membership/types";

export default function MembershipPage() {
  const me = useMe();
  const options = useResource<Options>("/api/me/membership");
  const payments = useResource<Payment[]>("/api/me/payments");
  const toast = useToast();
  const [changeTo, setChangeTo] = useState<PlanOption | null>(null);
  const [pausing, setPausing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const refresh = async () => {
    await Promise.all([options.reload(), me.reload()]);
  };
  const action = useMutation((fn: () => Promise<unknown>, _done: string) => fn(), {
    onSuccess: async (_, _fn, done) => {
      toast(done);
      await refresh();
    },
    onError: (e) => toast(e.message, "bad"),
  });
  // Stays busy after success while the browser goes to Stripe.
  const [redirecting, setRedirecting] = useState(false);
  const portal = useMutation(() => api<{ url: string }>("/api/billing-portal", { method: "POST" }), {
    onSuccess: ({ url }) => {
      setRedirecting(true);
      window.location.assign(url);
    },
    onError: (e) => toast(e.message, "bad"),
  });
  const busy = action.busy || portal.busy || redirecting;
  const run = (fn: () => Promise<unknown>, done: string) => void action.run(fn, done);
  const openPortal = () => void portal.run();

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
            {pausing ? <PauseDialog options={o.pause} onClose={() => setPausing(false)} onDone={refresh} /> : null}
            {cancelling ? <CancelDialog options={o.cancellation} onClose={() => setCancelling(false)} onDone={refresh} /> : null}
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
