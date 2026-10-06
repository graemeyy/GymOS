"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useResource } from "@/lib/client/api";
import { useCart } from "@/lib/client/cart";
import { fmtDate, fmtDateTime, invoiceNo } from "@/lib/format";
import { formatAud } from "@/lib/money";
import { gym } from "@/lib/config/client";
import { useBranding } from "@/components/branding/branding-provider";
import { ORDER_STATUS_TEXT, ORDER_STATUS_TONE, type OrderStatusName } from "@/lib/shop/labels";
import { PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock } from "@/components/ui/feedback";
import { MINUTE_MS } from "@/lib/time";

interface Order {
  id: string;
  number: number;
  status: OrderStatusName;
  fulfilment: "PICKUP" | "SHIPPING";
  subtotalCents: number;
  discountCents: number;
  discountPercent: number;
  shippingCents: number;
  totalCents: number;
  gstCents: number;
  shippingAddress: { line1: string; line2?: string; suburb: string; state: string; postcode: string } | null;
  trackingNumber: string | null;
  createdAt: string;
  items: { id: string; productName: string; variantLabel: string; quantity: number; lineTotalCents: number }[];
  events: { status: OrderStatusName; createdAt: string }[];
  payment: { id: string; invoiceNumber: number; refundedCents: number } | null;
  pickupAddress: { line1: string; line2?: string; suburb: string; state: string; postcode: string };
  changeOfMindReturnsDays: number;
}

export default function MyOrderPage() {
  return (
    <Suspense>
      <MyOrder />
    </Suspense>
  );
}

function MyOrder() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const pathname = usePathname();
  // Read once: the flag is removed from the URL below, but the thank-you
  // message and polling carry on for this visit.
  const [justPaid] = useState(() => params.get("paid") === "1");
  const order = useResource<Order>(`/api/me/orders/${id}`);
  const { clear } = useCart();
  const brand = useBranding();
  const { reload } = order;
  const waiting = order.data?.status === "PENDING_PAYMENT";

  // Back from Stripe: the cart is done with. Drop ?paid=1 so returning to
  // this page later (Back, a bookmark) can't empty a new cart (R-50).
  // Stripe's confirmation can take a few seconds to arrive, so check again
  // until the order shows as paid.
  useEffect(() => {
    if (!justPaid) return;
    clear();
    window.history.replaceState(null, "", pathname);
  }, [justPaid, clear, pathname]);
  useEffect(() => {
    if (!justPaid || !waiting) return;
    const timer = setInterval(() => void reload(), 3000);
    const stop = setTimeout(() => clearInterval(timer), MINUTE_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [justPaid, waiting, reload]);

  return (
    <AsyncBlock loading={order.loading} error={order.error} data={order.data} onRetry={order.reload} loadingLabel="Loading your order">
      {(o) => (
        <div className="space-y-6">
          <PageHeader title={`Order ${o.number}`} description={`Placed ${fmtDateTime(o.createdAt)}`} actions={<StatusTag tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_TEXT[o.status]}</StatusTag>} />
          {justPaid ? (
            <p role="status" className="rounded border border-good bg-good-tint px-4 py-3 text-sm font-medium text-good">
              {waiting ? "Payment received. Confirming with Stripe..." : "Thanks, your order is confirmed. We've emailed you a copy."}
            </p>
          ) : null}

          <Panel aria-labelledby="items">
            <PanelHeader id="items" title="Items" />
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 px-4 py-3 sm:px-5">
                  <span>
                    {i.quantity} x {i.productName} <span className="text-ink-soft">({i.variantLabel})</span>
                  </span>
                  <span className="tabular">{formatAud(i.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line px-4 py-3 text-sm sm:px-5">
              {o.discountCents > 0 ? <Row label={`Member discount (${o.discountPercent}%)`} value={`-${formatAud(o.discountCents)}`} /> : null}
              {o.fulfilment === "SHIPPING" ? <Row label="Shipping" value={o.shippingCents ? formatAud(o.shippingCents) : "Free"} /> : null}
              <Row label="Total" value={formatAud(o.totalCents)} strong />
              {gym.business.gstRegistered ? <Row label="Includes GST" value={formatAud(o.gstCents)} /> : null}
              {o.payment && o.payment.refundedCents > 0 ? <Row label="Refunded" value={formatAud(o.payment.refundedCents)} /> : null}
            </dl>
            {o.payment ? (
              <p className="border-t border-line px-4 py-3 text-sm sm:px-5">
                <Link href={`/member/invoice/${o.payment.id}`} className="font-medium text-plate underline underline-offset-2">
                  Tax invoice {invoiceNo(o.payment.invoiceNumber)}
                </Link>
              </p>
            ) : null}
          </Panel>

          <Panel aria-labelledby="delivery">
            <PanelHeader id="delivery" title={o.fulfilment === "PICKUP" ? "Pickup" : "Delivery"} />
            <div className="space-y-2 px-4 py-4 sm:px-5">
              {o.fulfilment === "PICKUP" ? (
                <p>
                  Collect from the front desk at {o.pickupAddress.line1}, {o.pickupAddress.suburb}. We&apos;ll email you when it&apos;s ready.
                </p>
              ) : (
                <>
                  {o.shippingAddress ? (
                    <address className="not-italic">
                      {o.shippingAddress.line1}
                      {o.shippingAddress.line2 ? <>, {o.shippingAddress.line2}</> : null}
                      <br />
                      {o.shippingAddress.suburb} {o.shippingAddress.state} {o.shippingAddress.postcode}
                    </address>
                  ) : null}
                  {o.trackingNumber ? <p>Tracking number: <span className="font-medium">{o.trackingNumber}</span></p> : null}
                </>
              )}
            </div>
          </Panel>

          <Panel aria-labelledby="progress">
            <PanelHeader id="progress" title="Progress" />
            <ol className="space-y-3 px-4 py-4 sm:px-5">
              {o.events.map((e, i) => (
                <li key={`${e.status}-${i}`} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-plate" />
                  <span>
                    <span className="font-medium">{ORDER_STATUS_TEXT[e.status]}</span>
                    <span className="block text-sm text-ink-soft">{fmtDateTime(e.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <p className="text-sm text-ink-soft">
            Something wrong with your order? Faulty or not as described items are covered by the Australian Consumer Law.
            {o.changeOfMindReturnsDays > 0 ? ` Change-of-mind returns are accepted within ${o.changeOfMindReturnsDays} days of ${fmtDate(o.createdAt)} for unused items.` : ""} Contact {brand.contactEmail}.
          </p>
        </div>
      )}
    </AsyncBlock>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-bold" : "flex justify-between text-ink-soft"}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
