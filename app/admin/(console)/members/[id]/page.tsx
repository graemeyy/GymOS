"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Archive, Pencil, QrCode } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { fmtDate, fmtDateTime, lastSeen } from "@/lib/client/format";
import { useStaff } from "@/components/admin/staff-session";
import { MemberFormDialog } from "@/components/admin/member-form-dialog";
import { MembershipPanel } from "@/components/admin/member/membership-panel";
import { BenefitsPanel } from "@/components/admin/member/benefits-panel";
import { NotesPanel } from "@/components/admin/member/notes-panel";
import { HistoryPanel } from "@/components/admin/member/history-panel";
import type { MemberDetail, PlanOptionFull } from "@/components/admin/member/types";
import { Button, LinkButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, ErrorState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/dialog";

function paymentTag(p: { status: string; refundedCents: number }) {
  if (p.status === "refunded") return <StatusTag tone="neutral">Refunded</StatusTag>;
  if (p.refundedCents > 0) return <StatusTag tone="warn">Part refunded</StatusTag>;
  return <StatusTag tone="good">Paid</StatusTag>;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useStaff();
  const member = useResource<MemberDetail>(`/api/members/${id}`);
  const plans = useResource<PlanOptionFull[]>("/api/admin/plans");
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // Bumped after a membership change so the benefits and history panels
  // reload along with the member (R-55).
  const [membershipVersion, setMembershipVersion] = useState(0);
  const reloadMember = member.reload;
  const membershipChanged = useCallback(async () => {
    setMembershipVersion((v) => v + 1);
    await reloadMember();
  }, [reloadMember]);

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

  // Sent once: a second tap would invalidate the pass just issued (R-57).
  const [reissuing, setReissuing] = useState(false);
  const reissuePass = async () => {
    setReissuing(true);
    try {
      await api(`/api/members/${id}/pass`, { method: "POST" });
      toast("New pass issued. The old one no longer works.");
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Couldn't reissue the pass.", "bad");
    } finally {
      setReissuing(false);
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
              description={`${m.email}. Member since ${fmtDate(m.createdAt)}. Last visit: ${lastSeen(m.lastCheckIn).toLowerCase()}.`}
              actions={
                m.archivedAt ? undefined : (
                  <>
                    {can("members:write") ? (
                      <Button variant="secondary" onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" /> Edit details
                      </Button>
                    ) : null}
                    {can("members:write") ? (
                      <Button variant="secondary" busy={reissuing} onClick={reissuePass}>
                        <QrCode className="h-4 w-4" aria-hidden="true" /> Reissue pass
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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MembershipPanel member={m} plans={plans.data ?? []} onChanged={membershipChanged} />
              <BenefitsPanel memberId={m.id} archived={Boolean(m.archivedAt)} version={membershipVersion} />

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

              <NotesPanel memberId={m.id} archived={Boolean(m.archivedAt)} />

              {m.payments ? (
                <Panel aria-labelledby="payments-heading">
                  <PanelHeader id="payments-heading" title="Payments" />
                  {m.payments.length === 0 ? (
                    <div className="p-4">
                      <EmptyState title="No payments recorded" />
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {m.payments.map((p) => (
                        <li key={p.id}>
                          <Link href={`/admin/billing/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sunken/60">
                            <span>
                              <span className="tabular font-medium">{formatAud(p.amount)}</span>{" "}
                              <span className="text-sm text-ink-soft">{p.description ?? "Payment"}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              {paymentTag(p)}
                              <span className="tabular text-sm text-ink-soft">{fmtDate(p.paidAt)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              ) : null}

              <HistoryPanel memberId={m.id} version={membershipVersion} />

              <Panel aria-labelledby="visits-heading">
                <PanelHeader id="visits-heading" title="Recent visits" />
                {m.checkIns.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No visits recorded" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {m.checkIns.slice(0, 8).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span>{c.location}</span>
                        <span className="tabular text-sm text-ink-soft">{fmtDateTime(c.timestamp)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {m.referredBy || m.referrals.length > 0 ? (
                <Panel aria-labelledby="referrals-heading">
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

            <MemberFormDialog open={editOpen} member={m} plans={(plans.data ?? []).filter((p) => p.active)} onClose={() => setEditOpen(false)} onSaved={member.reload} />
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
