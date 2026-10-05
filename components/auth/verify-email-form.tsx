"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, useMutation } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { FormMessage } from "@/components/ui/form";

// Confirming an email address (D-113). It takes a click rather than just
// opening the link, so email scanners that open links don't confirm it.
export function VerifyEmailForm() {
  const token = useSearchParams().get("token") ?? "";
  const [verified, setVerified] = useState(false);
  const confirm = useMutation(() => api("/api/auth/verify-email", { body: { token } }), { onSuccess: () => setVerified(true) });

  if (verified) {
    return (
      <div className="space-y-4" role="status">
        <p>Thanks. Your email address is confirmed.</p>
        <Link href="/member" className="font-medium text-plate underline underline-offset-2">
          Go to your membership
        </Link>
      </div>
    );
  }
  if (!token) return <p>Open the link from your email to confirm your address.</p>;
  return (
    <div className="space-y-4">
      <p>Confirm that this is your email address, so we can send you receipts and let you pay online.</p>
      {confirm.error ? <FormMessage>{confirm.error}</FormMessage> : null}
      <Button className="w-full" busy={confirm.busy} onClick={() => void confirm.run()}>
        Confirm my email address
      </Button>
    </div>
  );
}
