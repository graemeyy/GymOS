"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { fmtDate } from "@/lib/client/format";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/form";
import { Scoreboard } from "@/components/ui/scoreboard";
import { BarList } from "@/components/ui/bar-list";
import { CATEGORY_TEXT } from "@/lib/shop/labels";

interface Summary {
  label: string;
  periods: { key: string; label: string }[];
  grossCents: number;
  gstCollectedCents: number;
  refundsCents: number;
  refundsGstCents: number;
  netCents: number;
  netGstCents: number;
  paymentCount: number;
  byPlan: { name: string; cents: number; count: number }[];
  byProduct: { name: string; category: keyof typeof CATEGORY_TEXT; cents: number; quantity: number }[];
  outstanding: { memberId: string; name: string; email: string; owingCents: number; pastDueSince: string | null }[];
  outstandingTotalCents: number;
  otherCurrency: { currency: string; cents: number }[];
}

export default function FinancePage() {
  const [period, setPeriod] = useState("this-month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = period === "custom" ? (custom.from && custom.to ? `from=${custom.from}&to=${custom.to}` : null) : `period=${period}`;
  const summary = useResource<Summary>(range ? `/api/finance/summary?${range}` : null);
  const exportHref = (type: string) => (range ? `/api/finance/export?type=${type}&${range}` : undefined);

  return (
    <>
      <PageHeader title="Finance" description="Takings, refunds and GST for a period. Amounts are in AUD and include GST." />
      <Panel className="mb-6">
        <div className="grid gap-3 p-4 sm:grid-cols-[16rem_1fr_1fr] sm:items-end">
          <SelectField label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {(summary.data?.periods ?? [
              { key: "this-month", label: "This month" },
              { key: "last-month", label: "Last month" },
              { key: "this-quarter", label: "This BAS quarter" },
              { key: "financial-year", label: "This financial year" },
            ]).map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom dates</option>
          </SelectField>
          {period === "custom" ? (
            <>
              <TextField label="From" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              <TextField label="To" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </>
          ) : null}
        </div>
      </Panel>

      {!range ? (
        <EmptyState title="Choose both dates" />
      ) : (
        <AsyncBlock loading={summary.loading} error={summary.error} data={summary.data} onRetry={summary.reload} loadingLabel="Working out the figures">
          {(s) => (
            <>
              <Scoreboard
                label={`Totals for ${s.label}`}
                items={[
                  { label: "Takings", value: formatAud(s.grossCents, { whole: true }), note: `${s.paymentCount} payments` },
                  { label: "Refunds", value: formatAud(s.refundsCents, { whole: true }) },
                  { label: "Net", value: formatAud(s.netCents, { whole: true }) },
                  { label: "Owed by members", value: formatAud(s.outstandingTotalCents, { whole: true }), tone: "alert", note: "Not in takings" },
                ]}
              />
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel aria-labelledby="gst-heading">
                  <PanelHeader id="gst-heading" title="GST summary" />
                  <dl className="divide-y divide-line">
                    {[
                      ["Total sales incl. GST (G1)", s.grossCents],
                      ["GST on sales (1A)", s.gstCollectedCents],
                      ["Less GST on refunds", -s.refundsGstCents],
                      ["Net GST", s.netGstCents],
                    ].map(([label, cents]) => (
                      <div key={label as string} className="flex justify-between gap-3 px-4 py-3">
                        <dt>{label}</dt>
                        <dd className="tabular font-medium">{formatAud(cents as number)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">
                    A summary for your records, not tax advice. It covers sales through GymOS only, not your expenses or other income. Check it with your accountant before lodging a BAS.
                  </p>
                </Panel>
                <Panel aria-labelledby="exports-heading">
                  <PanelHeader id="exports-heading" title="Downloads" />
                  <ul className="divide-y divide-line">
                    {[
                      ["summary", "Summary", "Totals, GST and revenue by plan and product"],
                      ["payments", "Payments", "Every payment with invoice number and GST"],
                      ["refunds", "Refunds", "Every refund with reason and who made it"],
                    ].map(([type, title, desc]) => (
                      <li key={type}>
                        <a href={exportHref(type)} className="flex min-h-tap items-center justify-between gap-3 px-4 py-3 hover:bg-sunken/60" download>
                          <span>
                            <span className="font-medium">{title} (CSV)</span>
                            <span className="block text-sm text-ink-soft">{desc}</span>
                          </span>
                          <Download className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">Each file is labelled as a summary, not tax advice.</p>
                </Panel>
                <Panel aria-labelledby="plan-heading">
                  <PanelHeader id="plan-heading" title="Memberships by plan" />
                  <BarList rows={s.byPlan.map((p) => ({ name: `${p.name} (${p.count})`, value: p.cents }))} empty="No membership payments in this period." />
                </Panel>
                <Panel aria-labelledby="product-heading">
                  <PanelHeader id="product-heading" title="Shop by product" />
                  <BarList rows={s.byProduct.map((p) => ({ name: `${p.name}, ${CATEGORY_TEXT[p.category] ?? p.category} (${p.quantity} sold)`, value: p.cents }))} empty="No shop sales in this period." />
                </Panel>
                <Panel aria-labelledby="owing-heading" className="lg:col-span-2">
                  <PanelHeader id="owing-heading" title="Outstanding balances" />
                  {s.outstanding.length === 0 ? (
                    <div className="p-4">
                      <EmptyState title="Nobody owes anything" />
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {s.outstanding.map((o) => (
                        <li key={o.memberId} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span>
                            <Link href={`/admin/members/${o.memberId}`} className="font-medium hover:text-plate">
                              {o.name}
                            </Link>
                            {o.pastDueSince ? <span className="block text-sm text-ink-soft">Overdue since {fmtDate(o.pastDueSince)}</span> : null}
                          </span>
                          <span className="tabular font-medium">{o.owingCents ? formatAud(o.owingCents) : "Unknown"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                {s.otherCurrency.length > 0 ? (
                  <p className="text-sm text-ink-soft lg:col-span-2">
                    Not included above: payments recorded in another currency before GymOS switched to AUD ({s.otherCurrency.map((o) => `${(o.cents / 100).toFixed(2)} ${o.currency}`).join(", ")}).
                  </p>
                ) : null}
              </div>
            </>
          )}
        </AsyncBlock>
      )}
    </>
  );
}
