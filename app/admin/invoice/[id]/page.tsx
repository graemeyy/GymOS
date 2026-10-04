"use client";

import { useParams } from "next/navigation";
import { useResource } from "@/lib/client/api";
import type { TaxInvoice } from "@/lib/billing/invoice";
import { TaxInvoiceDocument } from "@/components/tax-invoice";
import { Button } from "@/components/ui/primitives";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";

// Standalone page (no staff menu) so it prints cleanly.
export default function StaffInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useResource<TaxInvoice>(`/api/payments/${id}/invoice`);
  return (
    <main className="min-h-dvh bg-white py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-2xl justify-end px-6 print:hidden">
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      {invoice.error ? <div className="mx-auto max-w-2xl px-6"><ErrorState message={invoice.error.message} onRetry={invoice.reload} /></div> : null}
      {invoice.loading && !invoice.data ? <LoadingRows label="Loading invoice" /> : null}
      {invoice.data ? <TaxInvoiceDocument invoice={invoice.data} /> : null}
    </main>
  );
}
