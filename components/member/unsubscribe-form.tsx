"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, useMutation, useResource } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import { FormMessage } from "@/components/ui/form";

interface Described {
  label: string;
  email: string;
  subscribed: boolean;
}

// The page an email's unsubscribe link opens (D-118). No sign-in needed; it
// takes one press, so mail scanners that open links don't unsubscribe anyone.
export function UnsubscribeForm() {
  const token = useSearchParams().get("token") ?? "";
  const path = `/api/unsubscribe?token=${encodeURIComponent(token)}`;
  const link = useResource<Described>(token ? path : null);
  const [done, setDone] = useState(false);
  const stop = useMutation(() => api(path, { method: "POST" }), { onSuccess: () => setDone(true) });

  const account = (
    <Link href="/member/account" className="font-medium text-plate underline underline-offset-2">
      your account
    </Link>
  );
  if (!token) return <p>Open the unsubscribe link from one of our emails, or switch emails off in {account}.</p>;
  if (link.loading) return <LoadingRows rows={2} />;
  if (link.error || !link.data) return <ErrorState message={link.error?.message ?? "This unsubscribe link isn't valid."} />;

  const { label, email, subscribed } = link.data;
  if (done || !subscribed) {
    return (
      <div className="space-y-3" role="status">
        <p>
          You&apos;re unsubscribed. We won&apos;t send {label} to {email}.
        </p>
        <p className="text-sm text-ink-soft">Receipts, booking confirmations and password emails still come, because they&apos;re about your account. To get {label} again, switch them back on in {account}.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p>
        Stop sending {label} to {email}?
      </p>
      {stop.error ? <FormMessage>{stop.error}</FormMessage> : null}
      <Button className="w-full" busy={stop.busy} onClick={() => void stop.run()}>
        Unsubscribe from {label}
      </Button>
    </div>
  );
}
