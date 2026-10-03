"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, useResource } from "@/lib/client/api";
import { formatAud, INTERVAL_LABELS } from "@/lib/money";
import { STATUS_TEXT } from "@/lib/client/labels";
import { Button, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { Wordmark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme";

interface Me {
  id: string;
  name: string | null;
  email: string;
  status: keyof typeof STATUS_TEXT;
  membershipPlan: { name: string; priceCents: number; interval: keyof typeof INTERVAL_LABELS } | null;
}

interface Bookings {
  bookings: { id: string; class: { id: string; name: string; startTime: string; instructor: string | null } }[];
}

const dateFmt = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Member home. Phase 3 adds booking, the QR pass, plan changes and the shop.
export default function MemberHome() {
  const router = useRouter();
  const me = useResource<Me>("/api/me");
  const bookings = useResource<Bookings>("/api/me/bookings");

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/member" className="rounded">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <AsyncBlock loading={me.loading} error={me.error} data={me.data} onRetry={me.reload} loadingLabel="Loading your membership">
          {(data) => (
            <section aria-labelledby="hello">
              <h1 id="hello" className="text-3xl">
                Hi {data.name?.split(" ")[0] ?? "there"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusTag tone={data.status === "ACTIVE" ? "good" : data.status === "PAST_DUE" ? "bad" : "neutral"}>{STATUS_TEXT[data.status]}</StatusTag>
                {data.membershipPlan ? (
                  <span className="text-ink-soft">
                    {data.membershipPlan.name}, {formatAud(data.membershipPlan.priceCents)} per {INTERVAL_LABELS[data.membershipPlan.interval].noun}
                  </span>
                ) : (
                  <span className="text-ink-soft">No plan yet</span>
                )}
              </div>
            </section>
          )}
        </AsyncBlock>

        <Panel aria-labelledby="upcoming">
          <PanelHeader id="upcoming" title="Your upcoming classes" />
          <AsyncBlock loading={bookings.loading} error={bookings.error} data={bookings.data} onRetry={bookings.reload}>
            {(data) =>
              data.bookings.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No classes booked">Ask at the front desk to book you in. Online booking is coming soon.</EmptyState>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {data.bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="font-medium">{b.class.name}</p>
                        {b.class.instructor ? <p className="text-sm text-ink-soft">with {b.class.instructor}</p> : null}
                      </div>
                      <time dateTime={b.class.startTime} className="tabular text-sm text-ink-soft">
                        {dateFmt.format(new Date(b.class.startTime))}
                      </time>
                    </li>
                  ))}
                </ul>
              )
            }
          </AsyncBlock>
        </Panel>
      </main>
    </div>
  );
}
