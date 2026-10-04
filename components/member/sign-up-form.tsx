"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "", acceptTerms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/api/auth/member-signup", { body: form });
      const plan = params.get("plan");
      router.push(plan && /^[a-z0-9-]{1,60}$/.test(plan) ? `/member/welcome?plan=${plan}` : "/member/welcome");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setFields(e.fields);
        setError(e.message);
      } else setError("Sign-up failed. Try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Your name" autoComplete="name" required value={form.name} error={fields.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <TextField label="Email" type="email" autoComplete="email" required value={form.email} error={fields.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
        value={form.password}
        error={fields.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-plate"
            checked={form.acceptTerms}
            aria-invalid={Boolean(fields.acceptTerms)}
            aria-describedby={fields.acceptTerms ? "terms-error" : undefined}
            onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="font-medium text-plate underline underline-offset-2">
              membership terms
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-plate underline underline-offset-2">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {fields.acceptTerms ? (
          <p id="terms-error" className="text-sm font-medium text-bad">
            {fields.acceptTerms}
          </p>
        ) : null}
      </div>
      {error && !Object.keys(fields).length ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" busy={busy} className="w-full">
        Create account
      </Button>
      <p className="text-sm text-ink-soft">We only ask for what we need to run your membership. You choose a plan and pay on the next step.</p>
    </form>
  );
}
