"use client";

import { useParams } from "next/navigation";
import { InvoiceView } from "@/components/invoice-view";

export default function MemberInvoicePage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceView url={`/api/me/payments/${id}/invoice`} back={{ href: "/member/membership", label: "Back to my membership" }} />;
}
