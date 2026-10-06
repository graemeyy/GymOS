"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { fmtDateTime } from "@/lib/format";
import { ORDER_STATUSES, ORDER_STATUS_TEXT, ORDER_STATUS_TONE, type OrderStatusName } from "@/lib/shop/labels";
import { PageHeader, Panel, StatusTag, LinkButton } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/form";
import { DataList } from "@/components/ui/data-list";
import { useLocationFilter } from "@/components/admin/location-filter";

interface OrderRow {
  id: string;
  number: number;
  status: OrderStatusName;
  fulfilment: "PICKUP" | "SHIPPING";
  customerName: string;
  totalCents: number;
  createdAt: string;
  location: { id: string; name: string } | null;
  _count: { items: number };
}

export default function OrdersPage() {
  const [status, setStatus] = useState("open");
  const query = status === "open" ? "open=1" : status ? `status=${status}` : "";
  const filter = useLocationFilter();
  const orders = useResource<OrderRow[]>(filter.ready ? `/api/orders?${query}${filter.param()}` : null);
  return (
    <>
      <PageHeader title="Orders" description="Shop orders from members. Pack them, then mark them ready for pickup or shipped." actions={<LinkButton href="/admin/shop" variant="secondary">Products</LinkButton>} />
      <Panel>
        <div className="border-b border-line p-4">
          <SelectField label="Show" value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="sm:w-72">
            <option value="open">To do (paid, packed, ready)</option>
            <option value="">All orders</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_TEXT[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <AsyncBlock loading={orders.loading} error={orders.error} data={orders.data} onRetry={orders.reload} loadingLabel="Loading orders">
          {(rows) =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title={status === "open" ? "Nothing to pack" : "No orders"} />
              </div>
            ) : (
              <DataList
                caption="Orders"
                rows={rows}
                rowKey={(o) => o.id}
                columns={[
                  {
                    header: "Order",
                    primary: true,
                    cell: (o) => (
                      <div>
                        <Link href={`/admin/shop/orders/${o.id}`} className="font-medium hover:text-plate">
                          #{o.number}, {o.customerName}
                        </Link>
                        <p className="text-sm text-ink-soft">
                          {o._count.items} item{o._count.items === 1 ? "" : "s"}, {o.fulfilment === "PICKUP" ? "pickup" : "shipping"}
                          {filter.multiple && !filter.selected && o.location ? `, ${o.location.name}` : ""}
                        </p>
                      </div>
                    ),
                  },
                  { header: "Status", cell: (o) => <StatusTag tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_TEXT[o.status]}</StatusTag> },
                  { header: "Placed", cell: (o) => <span className="tabular">{fmtDateTime(o.createdAt)}</span> },
                  { header: "Total", align: "right", cell: (o) => <span className="tabular font-medium">{formatAud(o.totalCents)}</span> },
                ]}
              />
            )
          }
        </AsyncBlock>
      </Panel>
    </>
  );
}
