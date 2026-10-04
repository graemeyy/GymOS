"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useMutation, useResource } from "@/lib/client/api";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";

// Where an invited staff member sets their password. The token in the link is
// the only credential; it works once.
function AcceptInvite() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const invite = useResource<{ name: string; email: string }>(token ? `/api/auth/invite?token=${encodeURIComponent(token)}` : null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const accept = useMutation(() => api("/api/auth/invite", { body: { token, password } }), {
    onSuccess: () => {
      setDone(true);
      router.push("/admin");
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMismatch(password !== confirm);
    if (password === confirm) void accept.run();
  };

  const signIn = (
    <Link href="/admin/login" className="font-medium text-plate underline underline-offset-2">
      Go to staff sign-in
    </Link>
  );
  if (!token) {
    return (
      <AuthFrame title="Invitation link needed" footer={signIn}>
        <p>Open the link from your invitation email. If it has expired, ask whoever invited you to send a new one.</p>
      </AuthFrame>
    );
  }
  if (invite.loading) return <AuthFrame title="Set your password"><LoadingRows rows={3} /></AuthFrame>;
  if (invite.error) {
    return (
      <AuthFrame title="Invitation not valid" footer={signIn}>
        <ErrorState message={invite.error.message} />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Set your password">
      <p className="mb-4 text-sm text-ink-soft">
        Welcome, {invite.data?.name}. You&apos;ll sign in with {invite.data?.email}.
      </p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Password" type="password" autoComplete="new-password" required hint="At least 10 characters." value={password} error={accept.fields.password} onChange={(e) => setPassword(e.target.value)} />
        <TextField label="Password again" type="password" autoComplete="new-password" required value={confirm} error={mismatch ? "The passwords don't match" : undefined} onChange={(e) => setConfirm(e.target.value)} />
        {accept.error ? <FormMessage>{accept.error}</FormMessage> : null}
        <Button type="submit" busy={accept.busy || done} className="w-full">
          Set password and sign in
        </Button>
      </form>
    </AuthFrame>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<AuthFrame title="Set your password"><LoadingRows rows={3} /></AuthFrame>}>
      <AcceptInvite />
    </Suspense>
  );
}
