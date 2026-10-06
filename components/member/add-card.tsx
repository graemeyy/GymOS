"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { api, useMutation } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { FormMessage } from "@/components/ui/form";
import type { Me } from "./types";

/** An imported membership with no card yet (D-131). */
export function needsCard(me: Me): boolean {
  return Boolean(me.importedAt && !me.billedOnline && me.membershipPlan && (me.status === "ACTIVE" || me.status === "PAUSED" || me.status === "PAST_DUE"));
}

// Card details never come across in an import, so a member brought in from
// another system adds one through Stripe. They're first charged after the
// date they'd already paid up to.
export function AddCard({ me }: { me: Me }) {
  const [agreed, setAgreed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const add = useMutation(() => api<{ url: string }>("/api/checkout", { body: { planId: me.membershipPlan!.id, acceptTerms: true } }), {
    onSuccess: ({ url }) => {
      setLeaving(true);
      window.location.assign(url);
    },
  });
  const paidTo = me.currentPeriodEnd ? fmtDate(new Date(new Date(me.currentPeriodEnd).getTime() - 1)) : null;
  return (
    <section aria-labelledby="add-card" className="space-y-3 rounded-lg border border-plate bg-plate-tint p-4">
      <h2 id="add-card" className="flex items-center gap-2 text-xl">
        <CreditCard className="h-5 w-5" aria-hidden="true" /> Add a card to keep your membership going
      </h2>
      <p className="text-sm">
        {me.status === "PAST_DUE"
          ? "Your membership was paid up to a date that has passed. Add a card to pay for it from today."
          : `Your card details didn't come across when your membership moved here. ${paidTo ? `You've paid up to ${paidTo}; your card is first charged after that.` : "Add one now."}`}{" "}
        Cards are handled by Stripe; the gym never sees the number.
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-plate" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-plate underline underline-offset-2">
            membership terms
          </Link>
          .
        </span>
      </label>
      {add.error ? <FormMessage>{add.error}</FormMessage> : null}
      <Button disabled={!agreed} busy={add.busy || leaving} onClick={() => void add.run()}>
        Add a card
      </Button>
    </section>
  );
}
