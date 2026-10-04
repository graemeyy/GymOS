"use client";

import Link from "next/link";
import { useResource } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { formatAud } from "@/lib/money";
import { ORDER_STATUS_TEXT, ORDER_STATUS_TONE, type OrderStatusName } from "@/lib/shop/labels";
import { LinkButton, PageHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";

interface OrderRow {
  id: string;
  number: number;
  status: OrderStatusName;
  fulfilment: "PICKUP" | "SHIPPING";
  totalCents: number;
  createdAt: string;
  _count: { items: number };
}

export default function MyOrdersPage() {
  const orders = useResource<OrderRow[]>("/api/me/orders");
  return (
    <div>
      <PageHeader title="My orders" actions={<LinkButton href="/shop" variant="secondary">Shop</LinkButton>} />
      <AsyncBlock loading={orders.loading} error={orders.error} data={orders.data} onRetry={orders.reload} loadingLabel="Loading your orders">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No orders yet" action={<LinkButton href="/shop">Browse the shop</LinkButton>}>
              Members get their plan&apos;s discount automatically.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {rows.map((o) => (
                <li key={o.id}>
                  <Link href={`/member/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sunken">
                    <span>
                      <span className="font-medium">Order {o.number}</span>
                      <span className="block text-sm text-ink-soft">
                        {fmtDate(o.createdAt)}, {o._count.items} {o._count.items === 1 ? "item" : "items"}, {formatAud(o.totalCents)}
                      </span>
                    </span>
                    <StatusTag tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_TEXT[o.status]}</StatusTag>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncBlock>
    </div>
  );
}
