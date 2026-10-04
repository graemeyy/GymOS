"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { formatAud, parseDollarsToCents } from "@/lib/money";
import { fmtDate, fmtDateTime, invoiceNo } from "@/lib/client/format";
import { useStaff } from "@/components/admin/staff-session";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";

interface PaymentDetail {
  id: string;
  amount: number;
  gstCents: number;
  refundedCents: number;
  refundableCents: number;
  currency: string;
  status: string;
  kind: string;
  description: string | null;
  invoiceNumber: number;
  paidAt: string;
  viaStripe: boolean;
  canRefundViaStripe: boolean;
  member: { id: string; name: string | null; email: string };
  order: { id: string; number: number; status: string } | null;
  refunds: { id: string; amountCents: number; gstCents: number; reason: string; method: string; staffName: string; createdAt: string }[];
}



export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useStaff();
  const toast = useToast();
  const payment = useResource<PaymentDetail>(`/api/payments/${id}`);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", reason: "", method: "STRIPE" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openRefund = (p: PaymentDetail) => {
    setForm({ amount: (p.refundableCents / 100).toFixed(2), reason: "", method: p.canRefundViaStripe ? "STRIPE" : "MANUAL" });
    setErrors({});
    setMessage(null);
    setOpen(true);
  };

  const submit = async () => {
    const amountCents = parseDollarsToCents(form.amount);
    if (!amountCents) return setErrors({ amountCents: "Enter an amount like 29.95" });
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await api(`/api/payments/${id}/refund`, { body: { amountCents, reason: form.reason, method: form.method } });
      toast(`Refunded ${formatAud(amountCents)}`);
      setOpen(false);
      void payment.reload();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fields);
        setMessage(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/admin/billing" className="mb-4 inline-flex min-h-tap items-center gap-2 rounded text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Payments
      </Link>
      <AsyncBlock loading={payment.loading} error={payment.error} data={payment.data} onRetry={payment.reload}>
        {(p) => (
          <>
            <PageHeader
              title={`${invoiceNo(p.invoiceNumber)}, ${formatAud(p.amount)}`}
              description={`${p.description ?? "Payment"} from ${p.member.name ?? p.member.email} on ${fmtDate(p.paidAt)}.`}
              actions={
                <>
                  <LinkButton href={`/admin/invoice/${p.id}`} variant="secondary" target="_blank">
                    <Printer className="h-4 w-4" aria-hidden="true" /> Tax invoice
                  </LinkButton>
                  {can("billing:refund") && p.refundableCents > 0 ? (
                    <Button variant="danger" onClick={() => openRefund(p)}>
                      Refund
                    </Button>
                  ) : null}
                </>
              }
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel aria-labelledby="summary-heading">
                <PanelHeader id="summary-heading" title="Summary" />
                <dl className="divide-y divide-line">
                  {[
                    ["Member", <Link key="m" href={`/admin/members/${p.member.id}`} className="font-medium text-plate underline-offset-2 hover:underline">{p.member.name ?? p.member.email}</Link>],
                    ["Amount incl. GST", <span key="a" className="tabular">{formatAud(p.amount)}</span>],
                    ["GST", <span key="g" className="tabular">{formatAud(p.gstCents)}</span>],
                    ["Refunded", <span key="r" className="tabular">{formatAud(p.refundedCents)}</span>],
                    ["Status", p.status === "refunded" ? <StatusTag key="s">Refunded</StatusTag> : p.refundedCents > 0 ? <StatusTag key="s" tone="warn">Part refunded</StatusTag> : <StatusTag key="s" tone="good">Paid</StatusTag>],
                    ["Paid through", p.viaStripe ? "Stripe" : "Recorded in GymOS"],
                    ...(p.order ? [["Shop order", <Link key="o" href={`/admin/shop/orders/${p.order.id}`} className="font-medium text-plate underline-offset-2 hover:underline">Order #{p.order.number}</Link>] as [string, React.ReactNode]] : []),
                  ].map(([label, value]) => (
                    <div key={label as string} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
                      <dt className="text-sm text-ink-soft">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Panel aria-labelledby="refunds-heading">
                <PanelHeader id="refunds-heading" title="Refunds" />
                {p.refunds.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No refunds" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {p.refunds.map((r) => (
                      <li key={r.id} className="px-4 py-3">
                        <p className="flex justify-between gap-3">
                          <span className="tabular font-medium">{formatAud(r.amountCents)}</span>
                          <span className="tabular text-sm text-ink-soft">{fmtDateTime(r.createdAt)}</span>
                        </p>
                        <p className="text-sm">{r.reason}</p>
                        <p className="text-sm text-ink-soft">
                          {r.method === "MANUAL" ? "Paid back outside Stripe" : "Refunded to card"} by {r.staffName}. Includes {formatAud(r.gstCents)} GST.
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Dialog
              open={open}
              onClose={() => setOpen(false)}
              title="Refund this payment"
              description={`Up to ${formatAud(p.refundableCents)} can be refunded. GST is reduced in proportion and shows in the finance reports.`}
              footer={
                <>
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Don&apos;t refund
                  </Button>
                  <Button variant="danger" busy={busy} onClick={submit}>
                    Refund {parseDollarsToCents(form.amount) ? formatAud(parseDollarsToCents(form.amount)!) : ""}
                  </Button>
                </>
              }
            >
              <div className="space-y-4">
                <TextField label="Amount (AUD)" inputMode="decimal" value={form.amount} error={errors.amountCents} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-autofocus />
                <TextField label="Reason" value={form.reason} error={errors.reason} hint="Shown on the payment and in the audit log." onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                <SelectField label="How" value={form.method} error={errors.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {p.canRefundViaStripe ? <option value="STRIPE">Refund to their card through Stripe</option> : null}
                  <option value="MANUAL">I paid it back another way (cash, bank transfer)</option>
                </SelectField>
                {message ? <FormMessage>{message}</FormMessage> : null}
              </div>
            </Dialog>
          </>
        )}
      </AsyncBlock>
    </>
  );
}
