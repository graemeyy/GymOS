"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useMutation, useResource } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import { FormMessage, TextField } from "@/components/ui/form";

// Choosing a new password from a reset link (D-112). Afterwards the person
// is signed in here and signed out everywhere else.
export function ResetPasswordForm({ forgotHref }: { forgotHref: string }) {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const link = useResource<{ kind: "staff" | "member" }>(token ? `/api/auth/password-reset?token=${encodeURIComponent(token)}` : null);
  const [form, setForm] = useState({ password: "", again: "" });
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const reset = useMutation(() => api<{ kind: "staff" | "member" }>("/api/auth/password-reset", { body: { token, password: form.password } }), {
    onSuccess: (result) => {
      setDone(true);
      router.push(result.kind === "staff" ? "/admin" : "/member");
      router.refresh();
    },
  });

  const again = (
    <Link href={forgotHref} className="font-medium text-plate underline underline-offset-2">
      Ask for a new link
    </Link>
  );
  if (!token) return <p>Open the link from your email. {again}.</p>;
  if (link.loading) return <LoadingRows rows={3} />;
  if (link.error) {
    return (
      <div className="space-y-3">
        <ErrorState message={link.error.message} />
        <p>{again}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        setMismatch(form.password !== form.again);
        if (form.password === form.again) void reset.run();
      }}
      className="space-y-4"
      noValidate
    >
      <TextField label="New password" type="password" autoComplete="new-password" required hint="At least 10 characters." value={form.password} error={reset.fields.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <TextField label="New password again" type="password" autoComplete="new-password" required value={form.again} error={mismatch ? "The passwords don't match" : undefined} onChange={(e) => setForm({ ...form, again: e.target.value })} />
      <p className="text-sm text-ink-soft">You&apos;ll be signed out on every other device.</p>
      {reset.error && !reset.fields.password ? <FormMessage>{reset.error}</FormMessage> : null}
      <Button type="submit" busy={reset.busy || done} className="w-full">
        Save new password
      </Button>
    </form>
  );
}
