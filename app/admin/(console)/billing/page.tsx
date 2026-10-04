"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { useResource } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import { formatAud } from "@/lib/money";
import { fmtDate } from "@/lib/client/format";
import { Button, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { DataList } from "@/components/ui/data-list";

interface Payment {
  id: string;
  amount: number;
  gstCents: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  member: { id: string; name: string | null; email: string; membershipPlan: { name: string } | null };
}

const money = (p: Payment, cents: number) => (p.currency.toLowerCase() === "aud" ? formatAud(cents) : `${(cents / 100).toFixed(2)} ${p.currency.toUpperCase()}`);

export default function PaymentsPage() {
  const payments = useResource<Payment[]>("/api/payments?take=200");
  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received from members, newest first. Amounts include GST."
        actions={
          <Button
            variant="secondary"
            disabled={!payments.data?.length}
            onClick={() =>
              payments.data &&
              downloadCsv("payments-summary.csv", payments.data, [
                { header: "Date", value: (p) => fmtDate(p.createdAt) },
                { header: "Member", value: (p) => p.member.name ?? p.member.email },
                { header: "Description", value: (p) => p.description ?? "" },
                { header: "Amount incl. GST", value: (p) => (p.amount / 100).toFixed(2) },
                { header: "GST", value: (p) => (p.gstCents / 100).toFixed(2) },
                { header: "Currency", value: (p) => p.currency.toUpperCase() },
                { header: "Status", value: (p) => p.status },
              ])
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export summary (CSV)
          </Button>
        }
      />
      <p className="mb-4 max-w-prose text-sm text-ink-soft">Exports are a summary for your records, not tax advice. Check figures with your accountant before lodging a BAS.</p>
      <Panel>
        <AsyncBlock loading={payments.loading} error={payments.error} data={payments.data} onRetry={payments.reload} loadingLabel="Loading payments">
          {(rows) =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No payments yet">They appear here as members pay through Stripe.</EmptyState>
              </div>
            ) : (
              <DataList
                caption="Payments"
                rows={rows}
                rowKey={(p) => p.id}
                columns={[
                  {
                    header: "Member",
                    primary: true,
                    cell: (p) => (
                      <div>
                        <Link href={`/admin/members/${p.member.id}`} className="font-medium hover:text-plate">
                          {p.member.name ?? p.member.email}
                        </Link>
                        <p className="text-sm text-ink-soft">{p.description ?? p.member.membershipPlan?.name ?? "Payment"}</p>
                      </div>
                    ),
                  },
                  { header: "Date", cell: (p) => <span className="tabular">{fmtDate(p.createdAt)}</span> },
                  { header: "Amount", align: "right", cell: (p) => <span className="tabular font-medium">{money(p, p.amount)}</span> },
                  { header: "GST", align: "right", cell: (p) => <span className="tabular text-ink-soft">{money(p, p.gstCents)}</span> },
                  { header: "Status", cell: (p) => <StatusTag tone={p.status === "succeeded" ? "good" : "neutral"}>{p.status === "succeeded" ? "Paid" : p.status}</StatusTag> },
                ]}
              />
            )
          }
        </AsyncBlock>
      </Panel>
    </>
  );
}
