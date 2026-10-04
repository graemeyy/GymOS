"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { useDebounced } from "@/lib/client/use-debounced";
import { formatAud } from "@/lib/money";
import { gym } from "@/lib/config/client";
import { fmtDate, invoiceNo } from "@/lib/client/format";
import { useStaff } from "@/components/admin/staff-session";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { SearchField, SelectField } from "@/components/ui/form";
import { DataList } from "@/components/ui/data-list";

interface Payment {
  id: string;
  amount: number;
  gstCents: number;
  refundedCents: number;
  currency: string;
  status: string;
  kind: "MEMBERSHIP" | "SHOP" | "OTHER";
  description: string | null;
  invoiceNumber: number;
  paidAt: string;
  member: { id: string; name: string | null; email: string };
}
interface Overdue {
  id: string;
  name: string | null;
  email: string;
  pastDueSince: string | null;
  amountOwingCents: number;
  canRetry: boolean;
  accessSuspended: boolean;
  membershipPlan: { name: string } | null;
  lastReminder: { day: number; sentAt: string } | null;
}

const money = (p: Payment, cents: number) => (p.currency.toLowerCase() === "aud" ? formatAud(cents) : `${(cents / 100).toFixed(2)} ${p.currency.toUpperCase()}`);


function statusTag(p: Payment) {
  if (p.status === "refunded") return <StatusTag>Refunded</StatusTag>;
  if (p.refundedCents > 0) return <StatusTag tone="warn">Part refunded</StatusTag>;
  return <StatusTag tone="good">Paid</StatusTag>;
}

function OverduePanel() {
  const { can } = useStaff();
  const toast = useToast();
  const overdue = useResource<Overdue[]>("/api/billing/overdue");
  const [busy, setBusy] = useState<string | null>(null);
  const retry = async (id: string) => {
    setBusy(id);
    try {
      const res = await api<{ paid: boolean }>(`/api/members/${id}/retry-payment`, { method: "POST" });
      toast(res.paid ? "Payment went through" : "Retry sent to Stripe");
      void overdue.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Retry failed.", "bad");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Panel aria-labelledby="overdue-heading" className="mb-6">
      <PanelHeader id="overdue-heading" title="Overdue payments" />
      <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">
        Stripe retries failed cards automatically. Members get reminder emails on days {gym.policies.failedPayments.reminderDays.join(", ")} and can still train for {gym.policies.failedPayments.suspendAccessAfterDays} days.
      </p>
      <AsyncBlock loading={overdue.loading} error={overdue.error} data={overdue.data} onRetry={overdue.reload}>
        {(rows) =>
          rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nobody is overdue" />
            </div>
          ) : (
            <DataList
              caption="Overdue members"
              rows={rows}
              rowKey={(m) => m.id}
              columns={[
                {
                  header: "Member",
                  primary: true,
                  cell: (m) => (
                    <div>
                      <Link href={`/admin/members/${m.id}`} className="font-medium hover:text-plate">
                        {m.name ?? m.email}
                      </Link>
                      <p className="text-sm text-ink-soft">{m.membershipPlan?.name ?? "No plan"}</p>
                    </div>
                  ),
                },
                { header: "Owing", align: "right", cell: (m) => <span className="tabular font-medium">{m.amountOwingCents ? formatAud(m.amountOwingCents) : "Unknown"}</span> },
                { header: "Since", cell: (m) => (m.pastDueSince ? fmtDate(m.pastDueSince) : "Unknown") },
                { header: "Access", cell: (m) => (m.accessSuspended ? <StatusTag tone="bad">Suspended</StatusTag> : <StatusTag tone="warn">Grace period</StatusTag>) },
                { header: "Last reminder", cell: (m) => (m.lastReminder ? `Day ${m.lastReminder.day}, ${fmtDate(m.lastReminder.sentAt)}` : "None yet") },
              ]}
              actions={
                can("billing:manage")
                  ? (m) =>
                      m.canRetry ? (
                        <Button variant="secondary" busy={busy === m.id} onClick={() => retry(m.id)}>
                          Retry
                        </Button>
                      ) : null
                  : undefined
              }
            />
          )
        }
      </AsyncBlock>
    </Panel>
  );
}

export default function PaymentsPage() {
  const { can } = useStaff();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const debounced = useDebounced(q);
  const params = new URLSearchParams({ take: "200" });
  if (debounced) params.set("q", debounced);
  if (kind) params.set("kind", kind);
  const payments = useResource<Payment[]>(`/api/payments?${params.toString()}`);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received, newest first. Amounts include GST. Open a payment to refund it or print its tax invoice."
        actions={can("finance:view") ? <LinkButton href="/admin/finance" variant="secondary">Finance reports</LinkButton> : undefined}
      />
      <OverduePanel />
      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_12rem]">
          <SearchField label="Search payments" placeholder="Member name, email or invoice number" value={q} onChange={setQ} />
          <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value)} wrapperClassName="[&>label]:sr-only">
            <option value="">All payments</option>
            <option value="MEMBERSHIP">Memberships</option>
            <option value="SHOP">Shop orders</option>
          </SelectField>
        </div>
        <AsyncBlock loading={payments.loading} error={payments.error} data={payments.data} onRetry={payments.reload} loadingLabel="Loading payments">
          {(rows) =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title={debounced || kind ? "No payments match" : "No payments yet"}>{debounced || kind ? "Try a different search." : "They appear here as members pay through Stripe."}</EmptyState>
              </div>
            ) : (
              <DataList
                caption="Payments"
                rows={rows}
                rowKey={(p) => p.id}
                columns={[
                  {
                    header: "Payment",
                    primary: true,
                    cell: (p) => (
                      <div>
                        <Link href={`/admin/billing/${p.id}`} className="font-medium hover:text-plate">
                          {p.member.name ?? p.member.email}
                        </Link>
                        <p className="text-sm text-ink-soft">
                          {invoiceNo(p.invoiceNumber)}, {p.description ?? "Payment"}
                        </p>
                      </div>
                    ),
                  },
                  { header: "Date", cell: (p) => <span className="tabular">{fmtDate(p.paidAt)}</span> },
                  { header: "Amount", align: "right", cell: (p) => <span className="tabular font-medium">{money(p, p.amount)}</span> },
                  { header: "GST", align: "right", cell: (p) => <span className="tabular text-ink-soft">{money(p, p.gstCents)}</span> },
                  { header: "Status", cell: statusTag },
                ]}
              />
            )
          }
        </AsyncBlock>
      </Panel>
    </>
  );
}
