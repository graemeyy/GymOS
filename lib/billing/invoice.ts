import { brandingFrom } from "@/lib/branding/defaults";
import { formatBrandAddress, type Branding } from "@/lib/branding/types";
import { invoiceNo } from "@/lib/format";

export interface InvoiceLine {
  description: string;
  quantity: number;
  amountCents: number;
}

export interface TaxInvoice {
  title: "Tax invoice" | "Receipt";
  number: string;
  issuedAt: Date;
  seller: { name: string; abn: string; address: string; email: string };
  buyer: { name: string; email: string };
  lines: InvoiceLine[];
  totalCents: number;
  gstCents: number;
  refundedCents: number;
  currency: string;
  note: string;
}

// Builds what a tax invoice must show (ATO, sales under $1,000): the words
// "Tax invoice", seller name and ABN, date, what was sold, the GST amount and
// the total. For sales of $1,000 or more the buyer's identity is also needed;
// the buyer's name and email are always included. A business that isn't
// registered for GST issues a receipt instead. Which one is decided by the
// GST recorded on the payment when it was made, not today's setting, so an
// old invoice still reads the same after the gym registers or deregisters
// (R-73, D-121).
export function buildTaxInvoice(payment: {
  invoiceNumber: number;
  paidAt: Date;
  amount: number;
  gstCents: number;
  refundedCents: number;
  currency: string;
  description: string | null;
  planName: string | null;
  member: { name: string | null; email: string };
  lines?: InvoiceLine[];
  // The seller's details from the Branding page (D-124).
}, seller: Branding = brandingFrom(null)): TaxInvoice {
  const registered = payment.gstCents > 0;
  return {
    title: registered ? "Tax invoice" : "Receipt",
    number: invoiceNo(payment.invoiceNumber),
    issuedAt: payment.paidAt,
    seller: { name: seller.legalName, abn: seller.abn, address: formatBrandAddress(seller.address), email: seller.contactEmail },
    buyer: { name: payment.member.name ?? payment.member.email, email: payment.member.email },
    lines: payment.lines ?? [{ description: payment.description ?? (payment.planName ? `${payment.planName} membership` : "Membership"), quantity: 1, amountCents: payment.amount }],
    totalCents: payment.amount,
    gstCents: registered ? payment.gstCents : 0,
    refundedCents: payment.refundedCents,
    currency: payment.currency.toUpperCase(),
    note: registered ? "Total price includes GST." : "No GST has been charged.",
  };
}
