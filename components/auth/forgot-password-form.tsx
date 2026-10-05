"use client";

import React, { useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";
import { PreviewLink } from "./preview-link";

// Asks for a reset link (D-112). The reply never says whether the address
// has an account.
export function ForgotPasswordForm({ kind }: { kind: "staff" | "member" }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const request = useMutation(() => api<{ ok: true; previewLink?: string }>("/api/auth/password-reset/request", { body: { kind, email } }), {
    onSuccess: (result) => {
      setSentTo(email);
      setPreviewLink(result.previewLink ?? null);
    },
  });

  if (sentTo) {
    return (
      <div className="space-y-4" role="status">
        <p>
          If <strong className="break-all">{sentTo}</strong> has a {kind === "staff" ? "staff" : "member"} account, we&apos;ve emailed it a link to choose a new password. The link works once, for 60 minutes.
        </p>
        <p className="text-sm text-ink-soft">Nothing there after a few minutes? Check your spam folder, or ask again.</p>
        {previewLink ? <PreviewLink href={previewLink} label="Open the reset link" /> : null}
        <Button variant="secondary" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        void request.run();
      }}
      className="space-y-4"
      noValidate
    >
      <p className="text-sm text-ink-soft">Enter the email you sign in with and we&apos;ll send you a link to choose a new password.</p>
      <TextField label="Email" type="email" autoComplete="email" required value={email} error={request.fields.email} onChange={(e) => setEmail(e.target.value)} />
      {request.error && !request.fields.email ? <FormMessage>{request.error}</FormMessage> : null}
      <Button type="submit" busy={request.busy} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
