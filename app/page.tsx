import Link from "next/link";
import { gym, formatAddress } from "@/lib/config";
import { listPlans, benefitsForSlug } from "@/lib/plans";
import { formatAud, INTERVAL_LABELS } from "@/lib/money";
import { Wordmark } from "@/components/ui/logo";
import { LinkButton } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" } as const;

function to12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

async function loadPlans() {
  try {
    return await listPlans();
  } catch {
    // Database unavailable: fall back to the plans in config so the page renders.
    return gym.plans.map((p, i) => ({ id: p.slug, slug: p.slug, name: p.name, description: p.description, priceCents: p.priceCents, interval: p.interval, active: true, sortOrder: i }));
  }
}

export default async function HomePage() {
  const plans = await loadPlans();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="rounded">
            <Wordmark />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost">
              Member sign in
            </LinkButton>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:pt-16">
          <h1 className="max-w-3xl text-4xl sm:text-5xl">{gym.brand.name}</h1>
          <p className="mt-3 max-w-prose text-lg text-ink-soft">{gym.brand.tagline}. {formatAddress()}.</p>
        </section>

        <section aria-labelledby="plans-heading" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-10">
            <h2 id="plans-heading" className="text-2xl">Memberships</h2>
            <p className="mt-1 text-ink-soft">Prices include GST. Cancel with {gym.policies.cancellation.noticeDays} days&apos; notice.</p>
            {/* A price board: one plan per row, price on the right, like the
                whiteboard behind a gym's front desk. Works for any number of plans. */}
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {plans.map((plan) => {
                const benefits = benefitsForSlug(plan.slug);
                const perks = [
                  benefits.classCreditsPerCycle === null
                    ? "Unlimited classes"
                    : benefits.classCreditsPerCycle > 0
                      ? `${benefits.classCreditsPerCycle} classes per ${INTERVAL_LABELS[plan.interval].noun}`
                      : null,
                  benefits.guestPassesPerCycle > 0 ? `${benefits.guestPassesPerCycle} guest pass per ${INTERVAL_LABELS[plan.interval].noun}` : null,
                  benefits.shopDiscountPercent > 0 ? `${benefits.shopDiscountPercent}% off in the shop` : null,
                ].filter(Boolean);
                return (
                  <li key={plan.id} className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:gap-8">
                    <div className="max-w-prose">
                      <h3 className="text-xl">{plan.name}</h3>
                      {plan.description ? <p className="mt-1 text-ink">{plan.description}</p> : null}
                      {perks.length ? <p className="mt-1 text-sm text-ink-soft">{perks.join(". ")}.</p> : null}
                    </div>
                    <p className="sm:text-right">
                      <span className="tabular font-display text-4xl font-bold leading-none">{formatAud(plan.priceCents)}</span>
                      <span className="block text-sm text-ink-soft">per {INTERVAL_LABELS[plan.interval].noun}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="hours-heading" className="mx-auto max-w-5xl px-4 py-10">
          <h2 id="hours-heading" className="text-2xl">Opening hours</h2>
          <dl className="mt-4 grid max-w-md grid-cols-[auto_1fr] gap-x-8 gap-y-1">
            {gym.hours.map((h) => (
              <div key={h.day} className="contents">
                <dt className="text-ink-soft">{DAY_NAMES[h.day]}</dt>
                <dd className="tabular">
                  {to12h(h.open)} to {to12h(h.close)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:justify-between">
          <span>
            {gym.business.legalName}, ABN {gym.business.abn}
          </span>
          <Link href="/admin/login" className="underline underline-offset-2">
            Staff sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
