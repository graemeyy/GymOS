"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useMutation, useResource } from "@/lib/client/api";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";

export default function SetupPage() {
  const router = useRouter();
  const status = useResource<{ needsSetup: boolean; tokenRequired: boolean }>("/api/auth/bootstrap");
  const [form, setForm] = useState({ name: "", email: "", password: "", setupToken: "" });
  // Stays busy after the account is created while the page moves to sign-in.
  const [created, setCreated] = useState(false);
  const create = useMutation((body: typeof form) => api("/api/auth/bootstrap", { body: { ...body, setupToken: body.setupToken || undefined } }), {
    onSuccess: () => {
      setCreated(true);
      router.push("/admin/login");
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void create.run(form);
  };

  if (status.loading) return <AuthFrame title="Set up"><LoadingRows rows={3} /></AuthFrame>;
  // A failed status check isn't "already set up" (R-60).
  if (status.error) return <AuthFrame title="Set up"><ErrorState message={status.error.message} onRetry={status.reload} /></AuthFrame>;

  if (!status.data?.needsSetup) {
    return (
      <AuthFrame title="Already set up">
        <p className="text-ink">This gym already has staff accounts. Ask the owner to add you.</p>
        <p className="mt-4">
          <Link href="/admin/login" className="font-medium text-plate underline underline-offset-2">Go to staff sign-in</Link>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create the owner account">
      <p className="mb-4 text-sm text-ink-soft">This form only works once, while no staff accounts exist.</p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Your name" autoComplete="name" required value={form.name} error={create.fields.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Email" type="email" autoComplete="email" required value={form.email} error={create.fields.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Password" type="password" autoComplete="new-password" required hint="At least 10 characters." value={form.password} error={create.fields.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {status.data?.tokenRequired ? (
          <TextField label="Setup token" autoComplete="off" required hint="The SETUP_TOKEN value from the hosting settings." value={form.setupToken} error={create.fields.setupToken} onChange={(e) => setForm({ ...form, setupToken: e.target.value })} />
        ) : null}
        {create.error ? <FormMessage>{create.error}</FormMessage> : null}
        <Button type="submit" busy={create.busy || created} className="w-full">
          Create owner account
        </Button>
      </form>
    </AuthFrame>
  );
}
