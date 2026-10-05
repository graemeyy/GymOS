"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useMutation } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";
import { safeNext } from "@/lib/client/safe-next";

export function SignInForm({ endpoint, home, prefix, forgotHref }: { endpoint: string; home: string; prefix: string; forgotHref?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Stays busy after success, while the browser moves on.
  const [redirecting, setRedirecting] = useState(false);
  const signIn = useMutation((body: { email: string; password: string }) => api<{ mustChangePassword?: boolean }>(endpoint, { body }), {
    onSuccess: (result) => {
      setRedirecting(true);
      const target = safeNext(params.get("next"), home, prefix);
      // Someone who must replace their password does that first, then goes
      // on to where they were heading (D-111).
      router.push(result?.mustChangePassword && target !== home ? `${home}?next=${encodeURIComponent(target)}` : target);
      router.refresh();
    },
  });
  const { error } = signIn;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void signIn.run({ email, password });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" busy={signIn.busy || redirecting} className="w-full">
        Sign in
      </Button>
      {forgotHref ? (
        <p className="text-center text-sm">
          <Link href={forgotHref} className="font-medium text-plate underline underline-offset-2">
            Forgot your password?
          </Link>
        </p>
      ) : null}
    </form>
  );
}
