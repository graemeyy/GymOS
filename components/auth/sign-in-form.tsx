"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";
import { safeNext } from "@/lib/client/safe-next";

export function SignInForm({ endpoint, home, prefix }: { endpoint: string; home: string; prefix: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(endpoint, { body: { email, password } });
      router.push(safeNext(params.get("next"), home, prefix));
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Sign-in failed. Try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" busy={busy} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
