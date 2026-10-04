"use client";

import Link from "next/link";
import { useResource } from "@/lib/client/api";
import type { TaxInvoice } from "@/lib/billing/invoice";
import { TaxInvoiceDocument } from "@/components/tax-invoice";
import { Button } from "@/components/ui/primitives";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";

// A standalone invoice page, without the staff or member menu, so it prints
// cleanly. Staff and members load it from their own API endpoints.
export function InvoiceView({ url, back }: { url: string; back?: { href: string; label: string } }) {
  const invoice = useResource<TaxInvoice>(url);
  return (
    <main className="min-h-dvh bg-white py-6 text-[#15191C] print:py-0">
      <div className={`mx-auto mb-4 flex max-w-2xl items-center gap-3 px-6 print:hidden ${back ? "justify-between" : "justify-end"}`}>
        {back ? (
          <Link href={back.href} className="text-sm font-medium text-[#1F5AA6] underline underline-offset-2">
            {back.label}
          </Link>
        ) : null}
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      {invoice.error ? (
        <div className="mx-auto max-w-2xl px-6">
          <ErrorState message={invoice.error.message} onRetry={invoice.reload} />
        </div>
      ) : null}
      {invoice.loading && !invoice.data ? <LoadingRows label="Loading invoice" /> : null}
      {invoice.data ? <TaxInvoiceDocument invoice={invoice.data} /> : null}
    </main>
  );
}
