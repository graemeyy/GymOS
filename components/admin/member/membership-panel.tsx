"use client";

import React, { useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { formatAud, formatPlanPrice } from "@/lib/money";
import { gym } from "@/lib/config/client";
import { fmtDate } from "@/lib/format";
import { STATUS_TEXT, STATUS_TONE } from "@/lib/members/labels";
import { Button, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { useStaff } from "@/components/admin/staff-session";
import { addCalendarDays, localDateIn } from "@/lib/dates";
import type { MemberDetail, PlanOptionFull } from "./types";

const todayIso = () => localDateIn(gym.business.timezone);
const plusDaysIso = (days: number) => addCalendarDays(todayIso(), days);

type Action = "plan" | "pause" | "cancel" | null;

export function MembershipPanel({ member, plans, onChanged }: { member: MemberDetail; plans: PlanOptionFull[]; onChanged: () => void }) {
  const { can } = useStaff();
  const toast = useToast();
  const [action, setAction] = useState<Action>(null);
  const [planId, setPlanId] = useState("");
  const [pause, setPause] = useState({ from: todayIso(), until: plusDaysIso(14) });
  const [cancel, setCancel] = useState({ reason: "", immediate: false });
  const canManage = can("members.edit") && !member.archivedAt;
  const policy = gym.policies;

  // One change at a time across the panel's buttons and dialogs.
  const change = useMutation((fn: () => Promise<unknown>, _success: string) => fn(), {
    onSuccess: (_result, _fn, success) => {
      toast(success);
      setAction(null);
      onChanged();
    },
    onError: (e) => {
      if (!action) toast(e.message, "bad");
    },
  });
  const { busy, fields: errors, error: message } = change;

  const open = (a: Action) => {
    change.reset();
    setPlanId("");
    setAction(a);
  };

  const run = (fn: () => Promise<unknown>, success: string) => void change.run(fn, success);

  const status = member.status;
  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusTag key="s" tone={STATUS_TONE[status]}>{STATUS_TEXT[status]}</StatusTag>],
    ["Plan", member.membershipPlan ? `${member.membershipPlan.name}, ${formatPlanPrice(member.membershipPlan.priceCents, member.membershipPlan.interval)}` : "None"],
    ["Next billing date", member.nextBillingDate ? fmtDate(member.nextBillingDate) : "None"],
  ];
  if (member.pendingPlan) rows.push(["Changing to", `${member.pendingPlan.name} from the next billing date`]);
  if (member.pausedUntil) rows.push(["Paused", `${member.pausedFrom ? fmtDate(member.pausedFrom) : "Now"} to ${fmtDate(member.pausedUntil)}`]);
  if (member.cancelAt) rows.push(["Cancelling", `Takes effect ${fmtDate(member.cancelAt)}${member.cancelReason ? `. Reason: ${member.cancelReason}` : ""}`]);
  if (member.cancelledAt) rows.push(["Cancelled", `${fmtDate(member.cancelledAt)}${member.cancelReason ? `. Reason: ${member.cancelReason}` : ""}`]);
  if (member.pastDueSince) rows.push(["Overdue since", `${fmtDate(member.pastDueSince)}${member.amountOwingCents ? `, ${formatAud(member.amountOwingCents)} owing` : ""}`]);

  return (
    <Panel aria-labelledby="membership-heading">
      <PanelHeader id="membership-heading" title="Membership" />
      <dl className="divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {canManage ? (
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          {status !== "CANCELED" ? (
            <Button variant="secondary" onClick={() => open("plan")}>
              Change plan
            </Button>
          ) : null}
          {status !== "CANCELED" && !member.pausedUntil ? (
            <Button variant="secondary" onClick={() => open("pause")}>
              Pause
            </Button>
          ) : null}
          {member.pausedUntil ? (
            <Button variant="secondary" busy={busy} onClick={() => run(() => api(`/api/members/${member.id}/pause`, { method: "DELETE" }), "Membership resumed")}>
              Resume now
            </Button>
          ) : null}
          {member.cancelAt ? (
            <Button variant="secondary" busy={busy} onClick={() => run(() => api(`/api/members/${member.id}/cancel`, { method: "DELETE" }), "Cancellation withdrawn")}>
              Withdraw cancellation
            </Button>
          ) : status !== "CANCELED" ? (
            <Button variant="danger" onClick={() => open("cancel")}>
              Cancel membership
            </Button>
          ) : null}
          {member.canRetryPayment ? (
            <Button variant="secondary" busy={busy} onClick={() => run(() => api(`/api/members/${member.id}/retry-payment`, { method: "POST" }), "Payment retried")}>
              Retry payment now
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={action === "plan"}
        onClose={() => setAction(null)}
        title="Change plan"
        description={`Upgrades: ${policy.planChanges.upgradeProration === "prorate_now" ? "start now, with the difference charged for the rest of this cycle" : "start at the next billing date"}. Downgrades: ${policy.planChanges.downgradeTiming === "immediate" ? "start now" : "start at the next billing date"}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Keep current plan
            </Button>
            <Button busy={busy} disabled={!planId} onClick={() => run(() => api(`/api/members/${member.id}/plan`, { body: { planId } }), "Plan change saved")}>
              Change plan
            </Button>
          </>
        }
      >
        <SelectField label="New plan" value={planId} error={errors.planId} onChange={(e) => setPlanId(e.target.value)} data-autofocus>
          <option value="">Choose a plan</option>
          {plans
            .filter((p) => p.active && p.id !== member.planId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}, {formatPlanPrice(p.priceCents, p.interval)}
              </option>
            ))}
        </SelectField>
        {message ? <div className="mt-4"><FormMessage>{message}</FormMessage></div> : null}
      </Dialog>

      <Dialog
        open={action === "pause"}
        onClose={() => setAction(null)}
        title="Pause membership"
        description={`Between ${policy.pause.minDays} and ${policy.pause.maxDays} days, up to ${policy.pause.maxPausesPerYear} times in 12 months. No payments are taken while paused${policy.pause.feeCents ? `, but there's a ${formatAud(policy.pause.feeCents)} pause fee to collect at the desk (it isn't charged automatically)` : ""}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              busy={busy}
              onClick={() =>
                run(
                  () => api(`/api/members/${member.id}/pause`, { body: { from: pause.from, until: pause.until } }),
                  "Pause booked"
                )
              }
            >
              Book pause
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="From" type="date" value={pause.from} error={errors.from} onChange={(e) => setPause({ ...pause, from: e.target.value })} data-autofocus />
          <TextField label="Back on" type="date" value={pause.until} error={errors.until} onChange={(e) => setPause({ ...pause, until: e.target.value })} />
        </div>
        {message ? <div className="mt-4"><FormMessage>{message}</FormMessage></div> : null}
      </Dialog>

      <Dialog
        open={action === "cancel"}
        onClose={() => setAction(null)}
        title="Cancel membership"
        description={`Under the gym's rules this takes effect after ${policy.cancellation.noticeDays} days' notice${policy.cancellation.coolingOffDays ? `, or straight away in the first ${policy.cancellation.coolingOffDays} days (cooling-off)` : ""}${policy.cancellation.minimumTermWeeks ? `, and not before the ${policy.cancellation.minimumTermWeeks}-week minimum term ends` : ""}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Keep membership
            </Button>
            <Button variant="danger" busy={busy} onClick={() => run(() => api(`/api/members/${member.id}/cancel`, { body: { reason: cancel.reason || undefined, immediate: cancel.immediate } }), "Cancellation booked")}>
              Cancel membership
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label="Reason (optional)" value={cancel.reason} error={errors.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} data-autofocus />
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={cancel.immediate} onChange={(e) => setCancel({ ...cancel, immediate: e.target.checked })} />
            <span>
              <span className="font-medium">End it today instead</span>
              <span className="block text-sm text-ink-soft">For example a medical or relocation case, or where the gym couldn&apos;t provide the service. Refunds are handled separately on the payment.</span>
            </span>
          </label>
          {message ? <FormMessage>{message}</FormMessage> : null}
        </div>
      </Dialog>
    </Panel>
  );
}
