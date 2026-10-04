"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { gym } from "@/lib/config/client";
import { localDateIn } from "@/lib/dates";
import { Button, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField, TextareaField } from "@/components/ui/form";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "ALL_ACTIVE" | "PLAN" | "STAFF_ONLY";
  planId: string | null;
  plan: { name: string } | null;
  publishedAt: string | null;
  expiresAt: string | null;
  emailedAt: string | null;
  emailCount: number;
  createdBy: { name: string } | null;
  createdAt: string;
}

const AUDIENCE_TEXT = { ALL_ACTIVE: "All current members", PLAN: "Members on one plan", STAFF_ONLY: "Staff only" } as const;
// The server stores the end of the chosen gym-local day (exclusive), so the
// last day shown is the gym-local date just before it (R-108).
const lastShownDay = (expiresAt: string) => localDateIn(gym.business.timezone, new Date(new Date(expiresAt).getTime() - 1));

const blank = { title: "", body: "", audience: "ALL_ACTIVE" as Announcement["audience"], planId: "", expiresAt: "" };

export default function AnnouncementsPage() {
  const toast = useToast();
  const list = useResource<Announcement[]>("/api/announcements");
  const plans = useResource<{ id: string; name: string }[]>("/api/plans");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState<Announcement | null>(null);
  // Separate in-flight flags, so the publish and delete buttons can't be
  // pressed twice (R-16, R-57).
  const [publishBusy, setPublishBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  const openForm = (a: Announcement | null) => {
    setEditing(a);
    setErrors({});
    setMessage(null);
    setForm(a ? { title: a.title, body: a.body, audience: a.audience, planId: a.planId ?? "", expiresAt: a.expiresAt ? lastShownDay(a.expiresAt) : "" } : blank);
    setOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    const body = { title: form.title, body: form.body, audience: form.audience, planId: form.audience === "PLAN" ? form.planId || null : null, expiresAt: form.expiresAt || null };
    try {
      await api(editing ? `/api/announcements/${editing.id}` : "/api/announcements", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Announcement saved" : "Draft saved");
      setOpen(false);
      void list.reload();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fields);
        setMessage(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!publishing || publishBusy) return;
    setPublishBusy(true);
    try {
      const email = Boolean(publishing.publishedAt) || sendEmail;
      const res = await api<{ emailed: number }>(`/api/announcements/${publishing.id}/publish`, { body: { email } });
      toast(email ? `Published and emailed to ${res.emailed} member${res.emailed === 1 ? "" : "s"}` : "Published");
      void list.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't publish.", "bad");
    } finally {
      setPublishBusy(false);
      setPublishing(null);
    }
  };

  const remove = async () => {
    if (!deleting || removeBusy) return;
    setRemoveBusy(true);
    try {
      await api(`/api/announcements/${deleting.id}`, { method: "DELETE" });
      toast("Announcement deleted");
      void list.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't delete.", "bad");
    } finally {
      setRemoveBusy(false);
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Notices members see in the app, such as holiday hours or class changes. You can also email them."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> New announcement
          </Button>
        }
      />
      <AsyncBlock loading={list.loading} error={list.error} data={list.data} onRetry={list.reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No announcements yet" action={<Button onClick={() => openForm(null)}>Write the first one</Button>} />
          ) : (
            <div className="space-y-4">
              {rows.map((a) => {
                const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
                return (
                  <Panel key={a.id} as="article" aria-labelledby={`a-${a.id}`} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 id={`a-${a.id}`} className="text-xl">
                          {a.title}
                        </h2>
                        <p className="mt-1 text-sm text-ink-soft">
                          {a.audience === "PLAN" ? `${a.plan?.name ?? "One plan"} members` : AUDIENCE_TEXT[a.audience]}
                          {a.expiresAt ? `, shown until ${fmtDate(new Date(new Date(a.expiresAt).getTime() - 1))}` : ""}
                        </p>
                      </div>
                      {a.publishedAt ? expired ? <StatusTag>Ended</StatusTag> : <StatusTag tone="good">Live since {fmtDate(a.publishedAt)}</StatusTag> : <StatusTag tone="warn">Draft</StatusTag>}
                    </div>
                    <p className="mt-3 max-w-prose whitespace-pre-line">{a.body}</p>
                    {a.emailedAt ? (
                      <p className="mt-2 text-sm text-ink-soft">
                        Emailed to {a.emailCount} member{a.emailCount === 1 ? "" : "s"} on {fmtDateTime(a.emailedAt)}.
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!a.publishedAt || (!a.emailedAt && a.audience !== "STAFF_ONLY") ? (
                        <Button
                          onClick={() => {
                            setSendEmail(false);
                            setPublishing(a);
                          }}
                        >
                          {a.publishedAt ? "Email it" : "Publish"}
                        </Button>
                      ) : null}
                      {!a.emailedAt ? (
                        <Button variant="secondary" onClick={() => openForm(a)}>
                          Edit
                        </Button>
                      ) : null}
                      <Button variant="ghost" onClick={() => setDeleting(a)}>
                        Delete
                      </Button>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )
        }
      </AsyncBlock>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit announcement" : "New announcement"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="announcement-form" busy={busy}>
              Save draft
            </Button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={save} className="space-y-4" noValidate>
          <TextField label="Title" value={form.title} error={errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-autofocus />
          <TextareaField label="Message" rows={5} value={form.body} error={errors.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Who sees it" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Announcement["audience"] })}>
              {Object.entries(AUDIENCE_TEXT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SelectField>
            {form.audience === "PLAN" ? (
              <SelectField label="Plan" value={form.planId} error={errors.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                <option value="">Choose a plan</option>
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <TextField label="Stop showing after (optional)" type="date" value={form.expiresAt} error={errors.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          {message ? <FormMessage>{message}</FormMessage> : null}
        </form>
      </Dialog>

      <Dialog
        open={Boolean(publishing)}
        onClose={() => setPublishing(null)}
        title={publishing?.publishedAt ? "Email this announcement" : "Publish this announcement"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishing(null)}>
              Not yet
            </Button>
            <Button onClick={publish} busy={publishBusy}>{publishing?.publishedAt ? "Send email" : sendEmail ? "Publish and email" : "Publish"}</Button>
          </>
        }
      >
        {publishing?.audience === "STAFF_ONLY" ? (
          <p>This is for staff only. It won&apos;t be shown to members or emailed.</p>
        ) : (
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={sendEmail || Boolean(publishing?.publishedAt)} disabled={Boolean(publishing?.publishedAt)} onChange={(e) => setSendEmail(e.target.checked)} />
            <span>
              <span className="font-medium">Also email it</span>
              <span className="block text-sm text-ink-soft">Only to members who haven&apos;t turned off announcement emails. It can only be sent once, and can&apos;t be edited after.</span>
            </span>
          </label>
        )}
      </Dialog>
      <ConfirmDialog open={Boolean(deleting)} onCancel={() => setDeleting(null)} onConfirm={remove} busy={removeBusy} title={`Delete "${deleting?.title ?? ""}"?`} confirmLabel="Delete" body="Members won't see it any more. Emails already sent can't be recalled." />
    </>
  );
}
