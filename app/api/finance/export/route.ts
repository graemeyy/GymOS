import { staffRoute } from "@/lib/http/route";
import { gym } from "@/lib/config";
import { toCsv } from "@/lib/csv";
import { logAction } from "@/lib/audit";
import { financeSummary } from "@/lib/finance/reports";
import { listPaymentsPaidBetween, listRefundsBetween } from "@/lib/finance/queries";
import { resolveRange } from "@/lib/finance/range";
import { ExportQuery } from "@/lib/finance/schema";

const dollars = (cents: number) => (cents / 100).toFixed(2);
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: gym.business.timezone }).format(d);

// CSV exports for the bookkeeper. Every file starts with a line saying it's a
// summary, not tax advice.
export const GET = staffRoute({ permission: "finance:view", query: ExportQuery }, async ({ query, db, staff }) => {
  const range = resolveRange(query);
  const header = [
    `# ${gym.business.legalName} (ABN ${gym.business.abn}). ${range.label}. Amounts in AUD and include GST.`,
    "# This is a summary for your records, not tax advice. Check it with your accountant before lodging a BAS.",
  ].join("\r\n");
  let body: string;
  if (query.type === "summary") {
    const s = await financeSummary(db, range.from, range.to);
    const rows = [
      { line: "Gross takings (G1)", amount: dollars(s.grossCents) },
      { line: "GST on sales (1A)", amount: dollars(s.gstCollectedCents) },
      { line: "Refunds", amount: dollars(-s.refundsCents) },
      { line: "GST on refunds", amount: dollars(-s.refundsGstCents) },
      { line: "Net takings", amount: dollars(s.netCents) },
      { line: "Net GST", amount: dollars(s.netGstCents) },
      ...s.byPlan.map((p) => ({ line: `Memberships: ${p.name}`, amount: dollars(p.cents) })),
      ...s.byProduct.map((p) => ({ line: `Shop: ${p.name}`, amount: dollars(p.cents) })),
      { line: "Outstanding member balances (not in takings)", amount: dollars(s.outstandingTotalCents) },
    ];
    body = toCsv(rows, [
      { header: "Line", value: (r) => r.line },
      { header: "Amount", value: (r) => r.amount },
    ]);
  } else if (query.type === "payments") {
    const rows = await listPaymentsPaidBetween(db, range.from, range.to);
    body = toCsv(rows, [
      { header: "Date", value: (p) => ymd(p.paidAt) },
      { header: "Invoice", value: (p) => `INV-${String(p.invoiceNumber).padStart(6, "0")}` },
      { header: "Member", value: (p) => p.member.name ?? p.member.email },
      { header: "Type", value: (p) => p.kind },
      { header: "Description", value: (p) => p.description ?? p.planName ?? "" },
      { header: "Amount incl. GST", value: (p) => dollars(p.amount) },
      { header: "GST", value: (p) => dollars(p.gstCents) },
      { header: "Refunded", value: (p) => dollars(p.refundedCents) },
      { header: "Currency", value: (p) => p.currency.toUpperCase() },
      { header: "Status", value: (p) => p.status },
    ]);
  } else {
    const rows = await listRefundsBetween(db, range.from, range.to);
    body = toCsv(rows, [
      { header: "Date", value: (r) => ymd(r.createdAt) },
      { header: "Invoice", value: (r) => `INV-${String(r.payment.invoiceNumber).padStart(6, "0")}` },
      { header: "Member", value: (r) => r.payment.member.name ?? r.payment.member.email },
      { header: "Amount incl. GST", value: (r) => dollars(r.amountCents) },
      { header: "GST", value: (r) => dollars(r.gstCents) },
      { header: "Method", value: (r) => (r.method === "MANUAL" ? "Manual" : "Stripe") },
      { header: "Reason", value: (r) => r.reason },
      { header: "By", value: (r) => r.staffName },
    ]);
  }
  await logAction(db, staff, { action: "finance.exported", targetType: "Report", details: { type: query.type, range: range.label } });
  const filename = `${query.type}-${ymd(range.from)}-to-${ymd(new Date(range.to.getTime() - 1))}.csv`;
  return new Response(`${header}\r\n${body}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
});
