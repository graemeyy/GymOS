"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { FormMessage, TextField } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/feedback";
import { useMe } from "@/components/member/member-shell";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Account" />
      <nav aria-label="Account sections">
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {[
            { href: "/member/membership", label: "My membership", hint: "Plan, pause, cancel, invoices" },
            { href: "/member/orders", label: "My orders", hint: "Shop orders and tracking" },
          ].map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sunken">
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-sm text-ink-soft">{item.hint}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-ink-soft" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ProfilePanel />
      <PreferencesPanel />
      <PasswordPanel />
      <DataPanel />
    </div>
  );
}

function ProfilePanel() {
  const me = useMe();
  const toast = useToast();
  const [name, setName] = useState("");
  useEffect(() => {
    if (me.data?.name) setName(me.data.name);
  }, [me.data?.name]);
  const save = useMutation((value: string) => api("/api/me", { method: "PATCH", body: { name: value } }), {
    onSuccess: async () => {
      toast("Name saved.");
      await me.reload();
    },
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void save.run(name);
  };
  return (
    <Panel aria-labelledby="profile">
      <PanelHeader id="profile" title="Your details" />
      <form onSubmit={submit} className="space-y-4 px-4 py-4 sm:px-5">
        <TextField label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={save.fields.name ?? save.error ?? undefined} />
        <TextField label="Email" type="email" value={me.data?.email ?? ""} readOnly hint="To change your email, ask at the front desk." />
        <Button type="submit" variant="secondary" busy={save.busy}>
          Save name
        </Button>
      </form>
    </Panel>
  );
}

function PreferencesPanel() {
  const me = useMe();
  const toast = useToast();
  const set = useMutation((field: "notifyAnnouncements" | "notifyWaitlist", value: boolean) => api("/api/me", { method: "PATCH", body: { [field]: value } }), {
    onSuccess: async () => {
      await me.reload();
      toast("Preference saved.");
    },
    onError: () => toast("That didn't save. Try again.", "bad"),
  });
  if (!me.data) return null;
  return (
    <Panel aria-labelledby="prefs">
      <PanelHeader id="prefs" title="Emails" />
      <div className="divide-y divide-line px-4 sm:px-5">
        <Switch label="Gym news" description="Announcements such as timetable changes and holiday hours." checked={me.data.notifyAnnouncements} disabled={set.busy} onChange={(v) => void set.run("notifyAnnouncements", v)} />
        <Switch label="Waitlist" description="An email when a spot opens and we book you in. You'll see it in your bookings either way." checked={me.data.notifyWaitlist} disabled={set.busy} onChange={(v) => void set.run("notifyWaitlist", v)} />
        <p className="py-3 text-sm text-ink-soft">Receipts, order updates and payment problems are always emailed, because they&apos;re about your account.</p>
      </div>
    </Panel>
  );
}

function PasswordPanel() {
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "" });
  const save = useMutation((body: { current: string; next: string }) => api("/api/me/password", { body }), {
    onSuccess: () => {
      setForm({ current: "", next: "" });
      toast("Password changed. You've been signed out on other devices.");
    },
  });
  const { fields } = save;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void save.run(form);
  };
  return (
    <Panel aria-labelledby="password">
      <PanelHeader id="password" title="Password" />
      <form onSubmit={submit} className="space-y-4 px-4 py-4 sm:px-5" noValidate>
        <TextField label="Current password" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} error={fields.current} />
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} error={fields.next} />
        {save.error && !fields.current && !fields.next ? <FormMessage>{save.error}</FormMessage> : null}
        <Button type="submit" variant="secondary" busy={save.busy}>
          Change password
        </Button>
      </form>
    </Panel>
  );
}

function DataPanel() {
  const blockers = useResource<{ blockers: { code: string; message: string }[] }>("/api/me/account");
  const [deleting, setDeleting] = useState(false);
  return (
    <Panel aria-labelledby="data">
      <PanelHeader id="data" title="Your data" />
      <div className="space-y-5 px-4 py-4 sm:px-5">
        <div className="space-y-2">
          <p>Download a copy of everything the gym holds about you in this app.</p>
          <a href="/api/me/export" download className="inline-flex min-h-tap items-center rounded border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-sunken">
            Download my data
          </a>
        </div>
        <div className="space-y-2 border-t border-line pt-5">
          <h3 className="text-lg">Delete my account</h3>
          <p className="text-ink-soft">
            This erases your name, email, bookings and notes. Payment records stay for the time tax law requires, without your details attached. See the{" "}
            <Link href="/privacy" className="font-medium text-plate underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
          {blockers.data?.blockers.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {blockers.data.blockers.map((b) => (
                <li key={b.code}>{b.message}</li>
              ))}
            </ul>
          ) : null}
          <Button variant="danger" disabled={!blockers.data || blockers.data.blockers.length > 0} onClick={() => setDeleting(true)}>
            Delete my account
          </Button>
        </div>
      </div>
      <DeleteDialog open={deleting} onClose={() => setDeleting(false)} />
    </Panel>
  );
}

function DeleteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Stays busy after success, while the browser leaves the page.
  const [leaving, setLeaving] = useState(false);
  const remove = useMutation((body: { password: string; confirm: string }) => api("/api/me/account", { method: "DELETE", body }), {
    onSuccess: () => {
      setLeaving(true);
      router.push("/?deleted=1");
      router.refresh();
    },
  });
  const { fields } = remove;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete my account"
      description="This can't be undone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep my account
          </Button>
          <Button variant="danger" onClick={() => void remove.run({ password, confirm })} busy={remove.busy || leaving} disabled={confirm !== "DELETE" || !password}>
            Delete my account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
        <TextField label="Type DELETE to confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fields.confirm} />
        {remove.error && !fields.password && !fields.confirm ? <FormMessage>{remove.error}</FormMessage> : null}
      </div>
    </Dialog>
  );
}
