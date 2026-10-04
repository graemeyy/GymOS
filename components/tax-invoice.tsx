import { formatAud } from "@/lib/money";
import { gym } from "@/lib/config";
import type { TaxInvoice } from "@/lib/billing/invoice";

// The gym's date, not the viewer's: the invoice date is a legal record (R-54).
const date = (v: string | Date) => new Intl.DateTimeFormat("en-AU", { timeZone: gym.business.timezone, day: "numeric", month: "long", year: "numeric" }).format(new Date(v));

// Print-friendly tax invoice. Uses only the light palette so it prints the
// same whatever theme the screen is in.
export function TaxInvoiceDocument({ invoice }: { invoice: Omit<TaxInvoice, "issuedAt"> & { issuedAt: string | Date } }) {
  return (
    <article className="mx-auto max-w-2xl bg-white p-6 text-[#15191C] sm:p-10 print:p-0">
      <header className="flex flex-col gap-4 border-b border-[#D5DADC] pb-6 sm:flex-row sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold">{invoice.title}</h1>
          <p className="mt-1 text-sm">
            {invoice.number}, issued {date(invoice.issuedAt)}
          </p>
        </div>
        <div className="text-sm sm:text-right">
          <p className="font-medium">{invoice.seller.name}</p>
          <p>ABN {invoice.seller.abn}</p>
          <p>{invoice.seller.address}</p>
          <p>{invoice.seller.email}</p>
        </div>
      </header>
      <section className="py-6 text-sm">
        <p className="text-[#565F66]">Billed to</p>
        <p className="font-medium">{invoice.buyer.name}</p>
        <p>{invoice.buyer.email}</p>
      </section>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#D5DADC] text-left text-[#565F66]">
            <th scope="col" className="py-2 font-medium">Description</th>
            <th scope="col" className="py-2 text-right font-medium">Qty</th>
            <th scope="col" className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i} className="border-b border-[#D5DADC]">
              <td className="py-2">{l.description}</td>
              <td className="tabular py-2 text-right">{l.quantity}</td>
              <td className="tabular py-2 text-right">{formatAud(l.amountCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2} className="pt-4 text-right font-medium">Total (AUD)</th>
            <td className="tabular pt-4 text-right font-display text-2xl font-bold">{formatAud(invoice.totalCents)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={2} className="py-1 text-right font-normal text-[#565F66]">GST included</th>
            <td className="tabular py-1 text-right">{formatAud(invoice.gstCents)}</td>
          </tr>
          {invoice.refundedCents > 0 ? (
            <tr>
              <th scope="row" colSpan={2} className="py-1 text-right font-normal text-[#565F66]">Refunded since</th>
              <td className="tabular py-1 text-right">{formatAud(invoice.refundedCents)}</td>
            </tr>
          ) : null}
        </tfoot>
      </table>
      <p className="mt-8 text-sm text-[#565F66]">{invoice.note}</p>
    </article>
  );
}
