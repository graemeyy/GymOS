"use client";

import { api, useMutation } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { formatAud, formatPlanPrice } from "@/lib/money";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import type { PlanOption } from "./types";

function changeText(plan: PlanOption) {
  const c = plan.change!;
  if (!c.immediate) return `Changes on ${fmtDate(c.effectiveAt)}, your next billing date. You keep your current plan until then.`;
  if (c.prorationCents === null) return `Starts now. Stripe charges or credits the difference for the rest of this billing period, then ${formatPlanPrice(plan.priceCents, plan.interval)}.`;
  if (c.prorationCents > 0) return `Starts now. Stripe charges about ${formatAud(c.prorationCents)} for the rest of this billing period, then ${formatPlanPrice(plan.priceCents, plan.interval)}.`;
  return `Starts now. Then ${formatPlanPrice(plan.priceCents, plan.interval)}.`;
}

export function ChangePlanDialog({ plan, onClose, onDone }: { plan: PlanOption; onClose: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const change = useMutation(() => api<{ immediate: boolean; effectiveAt: string }>("/api/me/membership/plan", { body: { planId: plan.id } }), {
    onSuccess: async (res) => {
      toast(res.immediate ? `You're now on ${plan.name}.` : `${plan.name} starts on ${fmtDate(res.effectiveAt)}.`);
      onClose();
      await onDone();
    },
  });
  if (!plan.change) return null;
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
          <Button onClick={() => void change.run()} busy={change.busy}>
            {plan.change.upgrade ? "Upgrade" : "Switch"} to {plan.name}
          </Button>
        </>
      }
    >
      <p>{changeText(plan)}</p>
      {change.error ? <div className="mt-3"><FormMessage>{change.error}</FormMessage></div> : null}
    </Dialog>
  );
}
