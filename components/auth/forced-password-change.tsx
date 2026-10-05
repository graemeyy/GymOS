"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api, useMutation } from "@/lib/client/api";
import { safeNext } from "@/lib/client/safe-next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";

const ENDPOINTS = {
  staff: { url: "/api/staff/me/password", current: "currentPassword", next: "newPassword", home: "/admin", login: "/admin/login" },
  member: { url: "/api/me/password", current: "current", next: "next", home: "/member", login: "/login" },
} as const;

// Shown instead of the app until someone replaces a password they were
// given: seeded demo accounts (D-111). The server refuses everything else
// until they do, so this is the only way on.
export function ForcedPasswordChange({ kind, name, onChanged }: { kind: "staff" | "member"; name: string; onChanged: () => void }) {
  const router = useRouter();
  const e = ENDPOINTS[kind];
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const change = useMutation(() => api(e.url, { body: { [e.current]: form.current, [e.next]: form.next } }), {
    onSuccess: () => {
      setDone(true);
      // Back to where they were going when they signed in, if anywhere.
      const target = safeNext(new URLSearchParams(window.location.search).get("next"), "", kind === "staff" ? "/admin" : "/");
      if (target) router.push(target);
      onChanged();
    },
  });
  const fields = change.fields as Record<string, string | undefined>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMismatch(form.next !== form.again);
    if (form.next === form.again) void change.run();
  };

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push(e.login);
    router.refresh();
  };

  return (
    <AuthFrame
      title="Choose a new password"
      footer={
        <button type="button" onClick={signOut} className="font-medium text-plate underline underline-offset-2">
          Sign out instead
        </button>
      }
    >
      <p className="mb-4 text-sm text-ink-soft">Hi {name}. Before you carry on, replace the password you were given with one only you know.</p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Current password" type="password" autoComplete="current-password" required value={form.current} error={fields[e.current]} onChange={(ev) => setForm({ ...form, current: ev.target.value })} />
        <TextField label="New password" type="password" autoComplete="new-password" required hint="At least 10 characters." value={form.next} error={fields[e.next]} onChange={(ev) => setForm({ ...form, next: ev.target.value })} />
        <TextField label="New password again" type="password" autoComplete="new-password" required value={form.again} error={mismatch ? "The passwords don't match" : undefined} onChange={(ev) => setForm({ ...form, again: ev.target.value })} />
        {change.error && Object.keys(change.fields).length === 0 ? <FormMessage>{change.error}</FormMessage> : null}
        <Button type="submit" busy={change.busy || done} className="w-full">
          Save new password
        </Button>
      </form>
    </AuthFrame>
  );
}
