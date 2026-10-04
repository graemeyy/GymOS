"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { fmtDateTime } from "@/lib/format";
import { ORDER_STATUS_TEXT, ORDER_STATUS_TONE, type OrderStatusName } from "@/lib/shop/labels";
import { useStaff } from "@/components/admin/staff-session";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, TextField } from "@/components/ui/form";

interface OrderDetail {
  id: string;
  number: number;
  status: OrderStatusName;
  fulfilment: "PICKUP" | "SHIPPING";
  customerName: string;
  email: string;
  subtotalCents: number;
  discountCents: number;
  discountPercent: number;
  shippingCents: number;
  totalCents: number;
  gstCents: number;
  trackingNumber: string | null;
  shippingAddress: { line1?: string; line2?: string; suburb?: string; state?: string; postcode?: string } | null;
  createdAt: string;
  member: { id: string; name: string | null } | null;
  payment: { id: string; amount: number; refundedCents: number; invoiceNumber: number } | null;
  items: { id: string; productName: string; variantLabel: string; unitPriceCents: number; quantity: number; lineTotalCents: number }[];
  events: { id: string; status: OrderStatusName; note: string | null; actorName: string; createdAt: string }[];
  nextStatuses: OrderStatusName[];
}

const ACTION_TEXT: Partial<Record<OrderStatusName, string>> = {
  PACKED: "Mark packed",
  READY_FOR_PICKUP: "Ready for pickup",
  SHIPPED: "Mark shipped",
  COMPLETED: "Mark collected",
  PAID: "Back to paid",
  CANCELLED: "Cancel order",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useStaff();
  const toast = useToast();
  const order = useResource<OrderDetail>(`/api/orders/${id}`);
  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The status being moved to, so only that button shows busy.
  const [moving, setMoving] = useState<OrderStatusName | null>(null);

  const move = useMutation<[status: OrderStatusName, trackingNumber?: string], unknown>(
    (status, trackingNumber) => {
      setMoving(status);
      setError(null);
      return api(`/api/orders/${id}`, { method: "PATCH", body: { status, trackingNumber } });
    },
    {
      onSuccess: (_result, status) => {
        toast(`Order ${ORDER_STATUS_TEXT[status].toLowerCase()}`);
        setShipOpen(false);
        void order.reload();
      },
      onError: (e) => {
        if (shipOpen) setError(e.message);
        else toast(e.message, "bad");
      },
    }
  );
  const busyStatus = move.busy ? moving : null;

  return (
    <>
      <Link href="/admin/shop/orders" className="mb-4 inline-flex min-h-tap items-center gap-2 rounded text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Orders
      </Link>
      <AsyncBlock loading={order.loading} error={order.error} data={order.data} onRetry={order.reload}>
        {(o) => (
          <>
            <PageHeader
              title={`Order #${o.number}`}
              description={`${o.customerName}, ${o.email}. Placed ${fmtDateTime(o.createdAt)}.`}
              actions={
                <>
                  <StatusTag tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_TEXT[o.status]}</StatusTag>
                  {o.payment ? (
                    <LinkButton href={`/admin/billing/${o.payment.id}`} variant="secondary">
                      Payment and refunds
                    </LinkButton>
                  ) : null}
                </>
              }
            />
            {can("orders:fulfil") && o.nextStatuses.length > 0 ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {o.nextStatuses.map((s) => (
                  <Button key={s} variant={s === "CANCELLED" ? "danger" : s === "PAID" ? "ghost" : "primary"} busy={busyStatus === s} onClick={() => (s === "SHIPPED" ? setShipOpen(true) : void move.run(s))}>
                    {ACTION_TEXT[s] ?? ORDER_STATUS_TEXT[s]}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
              <Panel aria-labelledby="items-heading">
                <PanelHeader id="items-heading" title="Items" />
                <ul className="divide-y divide-line">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 px-4 py-3">
                      <span>
                        <span className="font-medium">{i.productName}</span>
                        <span className="block text-sm text-ink-soft">
                          {i.variantLabel}, {i.quantity} × {formatAud(i.unitPriceCents)}
                        </span>
                      </span>
                      <span className="tabular font-medium">{formatAud(i.lineTotalCents)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1 border-t border-line px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd className="tabular">{formatAud(o.subtotalCents)}</dd>
                  </div>
                  {o.discountCents ? (
                    <div className="flex justify-between">
                      <dt>Member discount ({o.discountPercent}%)</dt>
                      <dd className="tabular">−{formatAud(o.discountCents)}</dd>
                    </div>
                  ) : null}
                  {o.shippingCents ? (
                    <div className="flex justify-between">
                      <dt>Shipping</dt>
                      <dd className="tabular">{formatAud(o.shippingCents)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-1 text-base font-semibold">
                    <dt>Total incl. GST</dt>
                    <dd className="tabular">{formatAud(o.totalCents)}</dd>
                  </div>
                  <div className="flex justify-between text-ink-soft">
                    <dt>GST included</dt>
                    <dd className="tabular">{formatAud(o.gstCents)}</dd>
                  </div>
                </dl>
              </Panel>
              <div className="space-y-6">
                <Panel aria-labelledby="delivery-heading">
                  <PanelHeader id="delivery-heading" title={o.fulfilment === "PICKUP" ? "Pickup" : "Shipping"} />
                  <div className="px-4 py-3 text-sm">
                    {o.fulfilment === "PICKUP" ? (
                      <p>Collect from the front desk.</p>
                    ) : (
                      <address className="not-italic">
                        {[o.shippingAddress?.line1, o.shippingAddress?.line2, `${o.shippingAddress?.suburb ?? ""} ${o.shippingAddress?.state ?? ""} ${o.shippingAddress?.postcode ?? ""}`.trim()].filter(Boolean).map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </address>
                    )}
                    {o.trackingNumber ? <p className="mt-2">Tracking: {o.trackingNumber}</p> : null}
                  </div>
                </Panel>
                <Panel aria-labelledby="timeline-heading">
                  <PanelHeader id="timeline-heading" title="Timeline" />
                  <ol className="divide-y divide-line">
                    {o.events.map((e) => (
                      <li key={e.id} className="px-4 py-2.5 text-sm">
                        <p className="font-medium">{ORDER_STATUS_TEXT[e.status]}</p>
                        <p className="text-ink-soft">
                          {e.actorName}, <span className="tabular">{fmtDateTime(e.createdAt)}</span>
                          {e.note ? `. ${e.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                </Panel>
              </div>
            </div>
            <Dialog
              open={shipOpen}
              onClose={() => setShipOpen(false)}
              title="Mark as shipped"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setShipOpen(false)}>
                    Cancel
                  </Button>
                  <Button busy={busyStatus === "SHIPPED"} onClick={() => void move.run("SHIPPED", tracking)}>
                    Mark shipped
                  </Button>
                </>
              }
            >
              <TextField label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} hint="The member sees this in their order history." data-autofocus />
              {error ? <div className="mt-4"><FormMessage>{error}</FormMessage></div> : null}
            </Dialog>
          </>
        )}
      </AsyncBlock>
    </>
  );
}
