"use client";

import { useParams } from "next/navigation";
import { InvoiceView } from "@/components/invoice-view";

export default function StaffInvoicePage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceView url={`/api/payments/${id}/invoice`} />;
}
