"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, useMutation, useResource } from "@/lib/client/api";
import { formatAud, INTERVAL_LABELS } from "@/lib/money";
import { cn } from "@/lib/client/cn";
import { Button, PageHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { FormMessage } from "@/components/ui/form";
import { useMe } from "@/components/member/member-shell";
import type { Interval } from "@/components/member/types";
import { planPerks } from "@/lib/plans/perks";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: Interval;
  benefits: { classCreditsPerCycle: number | null; guestPassesPerCycle: number; shopDiscountPercent: number };
}

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}

// After sign-up: choose a plan, then pay by card through Stripe or arrange
// payment at the front desk.
function Welcome() {
  const me = useMe();
  const plans = useResource<Plan[]>("/api/plans");
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once a payment choice succeeds, so its button stays busy while the
  // browser moves on.
  const [leaving, setLeaving] = useState<"card" | "desk" | null>(null);

  const preferred = plans.data?.find((p) => p.slug === params.get("plan"))?.id ?? null;
  const selected = chosen ?? preferred;

  const card = useMutation(
    async (planId: string) => {
      const { url } = await api<{ url: string }>("/api/checkout", { body: { planId, acceptTerms: true } });
      await api("/api/me/onboarding", { method: "POST" }).catch(() => undefined);
      return url;
    },
    {
      onSuccess: (url) => {
        setLeaving("card");
        window.location.assign(url);
      },
      onError: (e) => setError(e.message),
    }
  );

  const desk = useMutation(() => api("/api/me/onboarding", { method: "POST" }), {
    onSuccess: async () => {
      setLeaving("desk");
      await me.reload();
      toast("All set. Bring a card or cash to the front desk and staff will start your membership.");
      router.push("/member");
    },
    onError: () => setError("That didn't save. Try again."),
  });

  const payByCard = () => {
    if (!selected) return setError("Choose a membership first.");
    setError(null);
    void card.run(selected);
  };

  const anyBusy = card.busy || desk.busy || leaving !== null;

  return (
    <div>
      <PageHeader title={`Welcome${me.data?.name ? `, ${me.data.name.split(" ")[0]}` : ""}`} description="Choose a membership. Prices include GST and you can change plans later." />
      <AsyncBlock loading={plans.loading} error={plans.error} data={plans.data} onRetry={plans.reload} loadingLabel="Loading memberships">
        {(data) => (
          <fieldset>
            <legend className="sr-only">Membership</legend>
            <div className="space-y-3">
              {data.map((plan) => {
                const isSelected = selected === plan.id;
                return (
                  <label
                    key={plan.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-lg border bg-surface p-4 sm:p-5",
                      isSelected ? "border-plate ring-2 ring-plate/30" : "border-line hover:border-line-strong"
                    )}
                  >
                    <input type="radio" name="plan" value={plan.id} checked={isSelected} onChange={() => setChosen(plan.id)} className="mt-1 h-5 w-5 shrink-0 accent-plate" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <span className="font-display text-2xl font-bold">{plan.name}</span>
                        <span className="tabular">
                          <span className="font-display text-2xl font-bold">{formatAud(plan.priceCents)}</span>
                          <span className="text-sm text-ink-soft"> per {INTERVAL_LABELS[plan.interval].noun}</span>
                        </span>
                      </span>
                      {plan.description ? <span className="mt-1 block text-ink">{plan.description}</span> : null}
                      <span className="mt-1 block text-sm text-ink-soft">{planPerks(plan.benefits, plan.interval).join(". ")}.</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </AsyncBlock>
      <div className="mt-6 space-y-3">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <p className="text-sm text-ink-soft">
          By paying you agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-plate underline underline-offset-2">
            membership terms
          </Link>
          . Card payments are handled by Stripe; the gym never sees your card number.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={payByCard} busy={card.busy || leaving === "card"} disabled={anyBusy} className="sm:min-w-[12rem]">
            Pay by card
          </Button>
          <Button variant="secondary" onClick={() => void desk.run()} busy={desk.busy || leaving === "desk"} disabled={anyBusy}>
            I&apos;ll pay at the front desk
          </Button>
        </div>
      </div>
    </div>
  );
}
