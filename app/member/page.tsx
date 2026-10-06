"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, QrCode } from "lucide-react";
import { useResource } from "@/lib/client/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { formatAud } from "@/lib/money";
import { ORDER_STATUS_TEXT, ORDER_STATUS_TONE, type OrderStatusName } from "@/lib/shop/labels";
import { LinkButton, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { useMe } from "@/components/member/member-shell";
import { MembershipLine, membershipNotices } from "@/components/member/membership-summary";
import { cn } from "@/lib/client/cn";
import { AddCard, needsCard } from "@/components/member/add-card";

interface Bookings {
  bookings: { id: string; class: { id: string; name: string; startTime: string } }[];
  waitlist: { id: string; class: { id: string; name: string; startTime: string } }[];
}
interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}
interface OrderRow {
  id: string;
  number: number;
  status: OrderStatusName;
  totalCents: number;
  createdAt: string;
}

const NOTICE_TONE = { bad: "border-bad bg-bad-tint text-bad", warn: "border-warn bg-warn-tint text-warn", neutral: "border-line bg-sunken text-ink" } as const;

export default function MemberHomePage() {
  return (
    <Suspense>
      <MemberHome />
    </Suspense>
  );
}

function MemberHome() {
  const me = useMe();
  const bookings = useResource<Bookings>("/api/me/bookings");
  const announcements = useResource<Announcement[]>("/api/me/announcements");
  const orders = useResource<OrderRow[]>("/api/me/orders");
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const result = params.get("checkout");
    if (!result) return;
    if (result === "success") toast("Payment received. Your membership starts as soon as Stripe confirms it, usually within a minute.");
    if (result === "cancelled") toast("Checkout cancelled. Nothing was charged.", "bad");
    router.replace("/member");
    // Re-read after Stripe's confirmation has had a moment to arrive.
    const timer = setTimeout(() => void me.reload(), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <AsyncBlock loading={me.loading} error={me.error} data={me.data} onRetry={me.reload} loadingLabel="Loading your membership">
        {(data) => (
          <section aria-labelledby="hello" className="space-y-4">
            <div>
              <h1 id="hello" className="text-3xl sm:text-4xl">
                Hi {data.name?.split(" ")[0] ?? "there"}
              </h1>
              <div className="mt-2">
                <MembershipLine me={data} />
              </div>
            </div>
            {membershipNotices(data).map((n) => (
              <p key={n.text} className={cn("rounded border px-4 py-3 text-sm font-medium", NOTICE_TONE[n.tone])}>
                {n.text}
              </p>
            ))}
            {needsCard(data) ? <AddCard me={data} /> : null}
            {data.status === "PENDING" || data.status === "CANCELED" ? (
              <LinkButton href="/member/welcome">Choose a membership</LinkButton>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <LinkButton href="/member/pass" className="h-auto min-h-[4rem] justify-start text-base">
                  <QrCode className="h-6 w-6" aria-hidden="true" />
                  Show my pass
                </LinkButton>
                <LinkButton href="/member/classes" variant="secondary" className="h-auto min-h-[4rem] justify-start text-base">
                  <CalendarDays className="h-6 w-6" aria-hidden="true" />
                  Book a class
                </LinkButton>
              </div>
            )}
            {data.membershipPlan && data.status !== "CANCELED" ? (
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
                <Stat label="Classes left this cycle" value={data.usage.classCreditsRemaining === null ? "Unlimited" : String(Math.max(0, data.usage.classCreditsRemaining))} />
                <Stat label="Guest passes left" value={String(Math.max(0, data.usage.guestPassesRemaining ?? 0))} />
                <Stat wide label="Next billing date" value={data.currentPeriodEnd ? fmtDate(data.currentPeriodEnd) : data.usage.cycleEnd ? fmtDate(data.usage.cycleEnd) : "Not set"} />
              </dl>
            ) : null}
          </section>
        )}
      </AsyncBlock>

      <Panel aria-labelledby="upcoming">
        <PanelHeader id="upcoming" title="Your upcoming classes" action={<Link href="/member/classes" className="text-sm font-medium text-plate underline underline-offset-2">Timetable</Link>} />
        <AsyncBlock loading={bookings.loading} error={bookings.error} data={bookings.data} onRetry={bookings.reload}>
          {(data) =>
            data.bookings.length === 0 && data.waitlist.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No classes booked">See what&apos;s on this week and book a spot.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {data.bookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <p className="font-medium">{b.class.name}</p>
                      <p className="text-sm text-ink-soft">{fmtDateTime(b.class.startTime)}</p>
                    </div>
                    <StatusTag tone="good">Booked</StatusTag>
                  </li>
                ))}
                {data.waitlist.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <p className="font-medium">{w.class.name}</p>
                      <p className="text-sm text-ink-soft">{fmtDateTime(w.class.startTime)}</p>
                    </div>
                    <StatusTag tone="warn">Waitlist</StatusTag>
                  </li>
                ))}
              </ul>
            )
          }
        </AsyncBlock>
      </Panel>

      <AsyncBlock loading={announcements.loading} error={announcements.error} data={announcements.data} onRetry={announcements.reload}>
        {(data) =>
          data.length === 0 ? null : (
            <Panel aria-labelledby="news">
              <PanelHeader id="news" title="From the gym" />
              <ul className="divide-y divide-line">
                {data.map((a) => (
                  <li key={a.id} className="px-4 py-4 sm:px-5">
                    <h3 className="text-lg">{a.title}</h3>
                    <p className="text-sm text-ink-soft">{fmtDate(a.publishedAt)}</p>
                    <p className="mt-2 whitespace-pre-line">{a.body}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )
        }
      </AsyncBlock>

      <AsyncBlock loading={orders.loading} error={orders.error} data={orders.data} onRetry={orders.reload}>
        {(data) =>
          data.length === 0 ? null : (
            <Panel aria-labelledby="orders">
              <PanelHeader id="orders" title="Recent orders" action={<Link href="/member/orders" className="text-sm font-medium text-plate underline underline-offset-2">All orders</Link>} />
              <ul className="divide-y divide-line">
                {data.slice(0, 3).map((o) => (
                  <li key={o.id}>
                    <Link href={`/member/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sunken sm:px-5">
                      <span>
                        <span className="font-medium">Order {o.number}</span>
                        <span className="block text-sm text-ink-soft">
                          {fmtDate(o.createdAt)}, {formatAud(o.totalCents)}
                        </span>
                      </span>
                      <StatusTag tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_TEXT[o.status]}</StatusTag>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )
        }
      </AsyncBlock>
    </div>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("bg-surface px-4 py-3", wide && "col-span-2 sm:col-span-1")}>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="tabular font-display text-2xl font-bold">{value}</dd>
    </div>
  );
}
