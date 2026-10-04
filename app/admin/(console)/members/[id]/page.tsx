"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Archive, Pencil } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { formatAud, INTERVAL_LABELS } from "@/lib/money";
import { fmtDate, fmtDateTime, lastSeen } from "@/lib/client/format";
import { STATUS_TEXT, STATUS_TONE, type MemberStatus } from "@/lib/client/labels";
import { useStaff } from "@/components/admin/staff-session";
import { MemberFormDialog, type PlanOption } from "@/components/admin/member-form-dialog";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, ErrorState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/dialog";

interface MemberDetail {
  id: string;
  name: string | null;
  email: string;
  status: MemberStatus;
  planId: string | null;
  membershipPlan: { id: string; name: string; priceCents: number; interval: keyof typeof INTERVAL_LABELS } | null;
  keycardIssued: boolean;
  lastCheckIn: string | null;
  retentionScore: number;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  checkIns: { id: string; location: string; timestamp: string }[];
  payments: { id: string; amount: number; gstCents: number; currency: string; status: string; createdAt: string }[] | null;
  classBookings: { id: string; class: { id: string; name: string; startTime: string; instructor: string | null } }[];
  classWaitlist: { id: string; class: { id: string; name: string; startTime: string } }[];
  referredBy: { id: string; name: string | null; email: string } | null;
  referrals: { id: string; name: string | null; email: string; createdAt: string }[];
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useStaff();
  const member = useResource<MemberDetail>(`/api/members/${id}`);
  const plans = useResource<PlanOption[]>("/api/plans");
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const archive = async () => {
    setArchiving(true);
    try {
      await api(`/api/members/${id}`, { method: "DELETE" });
      toast("Member archived");
      router.push("/admin/members");
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't archive the member.", "bad");
      setArchiving(false);
      setArchiveOpen(false);
    }
  };

  if (member.error?.status === 404) {
    return (
      <>
        <PageHeader title="Member not found" description="They may have been removed, or the link is wrong." />
        <LinkButton href="/admin/members" variant="secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to members
        </LinkButton>
      </>
    );
  }

  return (
    <>
      <Link href="/admin/members" className="mb-4 inline-flex min-h-tap items-center gap-2 rounded text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Members
      </Link>
      <AsyncBlock loading={member.loading} error={member.error} data={member.data} onRetry={member.reload} loadingLabel="Loading member">
        {(m) => (
          <>
            <PageHeader
              title={m.name ?? m.email}
              description={m.email}
              actions={
                m.archivedAt ? undefined : (
                  <>
                    {can("members:write") ? (
                      <Button variant="secondary" onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                      </Button>
                    ) : null}
                    {can("members:archive") ? (
                      <Button variant="danger" onClick={() => setArchiveOpen(true)}>
                        <Archive className="h-4 w-4" aria-hidden="true" /> Archive
                      </Button>
                    ) : null}
                  </>
                )
              }
            />
            {m.archivedAt ? (
              <div className="mb-6">
                <ErrorState message={`Archived on ${fmtDate(m.archivedAt)}. This member can't sign in or book. Their payment history is kept.`} />
              </div>
            ) : null}

            <Panel className="mb-6">
              <dl className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
                <Fact label="Status">
                  <StatusTag tone={STATUS_TONE[m.status]}>{STATUS_TEXT[m.status]}</StatusTag>
                </Fact>
                <Fact label="Plan">
                  {m.membershipPlan ? `${m.membershipPlan.name}, ${formatAud(m.membershipPlan.priceCents)}/${INTERVAL_LABELS[m.membershipPlan.interval].noun}` : "None"}
                </Fact>
                <Fact label="Last visit">{lastSeen(m.lastCheckIn)}</Fact>
                <Fact label="Member since">{fmtDate(m.createdAt)}</Fact>
              </dl>
            </Panel>

            {m.notes ? (
              <Panel className="mb-6" aria-labelledby="notes-heading">
                <PanelHeader id="notes-heading" title="Notes" />
                <p className="whitespace-pre-line px-4 py-3">{m.notes}</p>
              </Panel>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel aria-labelledby="classes-heading">
                <PanelHeader id="classes-heading" title="Upcoming classes" />
                {m.classBookings.length === 0 && m.classWaitlist.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No classes booked" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {m.classBookings.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="font-medium">{b.class.name}</span>
                        <span className="tabular text-sm text-ink-soft">{fmtDateTime(b.class.startTime)}</span>
                      </li>
                    ))}
                    {m.classWaitlist.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span>
                          <span className="font-medium">{w.class.name}</span> <StatusTag tone="warn">Waitlist</StatusTag>
                        </span>
                        <span className="tabular text-sm text-ink-soft">{fmtDateTime(w.class.startTime)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel aria-labelledby="visits-heading">
                <PanelHeader id="visits-heading" title="Recent visits" />
                {m.checkIns.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No visits recorded" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {m.checkIns.slice(0, 10).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span>{c.location}</span>
                        <span className="tabular text-sm text-ink-soft">{fmtDateTime(c.timestamp)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {m.payments ? (
                <Panel aria-labelledby="payments-heading" className="lg:col-span-2">
                  <PanelHeader id="payments-heading" title="Payments" />
                  {m.payments.length === 0 ? (
                    <div className="p-4">
                      <EmptyState title="No payments recorded" />
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {m.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="tabular">
                            {formatAud(p.amount)} <span className="text-sm text-ink-soft">incl. {formatAud(p.gstCents)} GST</span>
                          </span>
                          <span className="tabular text-sm text-ink-soft">{fmtDate(p.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              ) : null}

              {m.referredBy || m.referrals.length > 0 ? (
                <Panel aria-labelledby="referrals-heading" className="lg:col-span-2">
                  <PanelHeader id="referrals-heading" title="Referrals" />
                  <div className="space-y-2 px-4 py-3 text-sm">
                    {m.referredBy ? (
                      <p>
                        Referred by{" "}
                        <Link className="font-medium text-plate underline-offset-2 hover:underline" href={`/admin/members/${m.referredBy.id}`}>
                          {m.referredBy.name ?? m.referredBy.email}
                        </Link>
                      </p>
                    ) : null}
                    {m.referrals.length > 0 ? (
                      <p>
                        Brought in:{" "}
                        {m.referrals.map((r, i) => (
                          <React.Fragment key={r.id}>
                            {i > 0 ? ", " : null}
                            <Link className="font-medium text-plate underline-offset-2 hover:underline" href={`/admin/members/${r.id}`}>
                              {r.name ?? r.email}
                            </Link>
                          </React.Fragment>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </Panel>
              ) : null}
            </div>

            <MemberFormDialog open={editOpen} member={m} plans={plans.data ?? []} onClose={() => setEditOpen(false)} onSaved={member.reload} />
            <ConfirmDialog
              open={archiveOpen}
              onCancel={() => setArchiveOpen(false)}
              onConfirm={archive}
              busy={archiving}
              title={`Archive ${m.name ?? m.email}?`}
              confirmLabel="Archive member"
              body={
                <ul className="list-disc space-y-1 pl-5">
                  <li>Their Stripe subscription is cancelled now.</li>
                  <li>Future class bookings and waitlist places are released.</li>
                  <li>They can&apos;t sign in. Payments and visit history are kept for the gym&apos;s records.</li>
                </ul>
              }
            />
          </>
        )}
      </AsyncBlock>
    </>
  );
}
