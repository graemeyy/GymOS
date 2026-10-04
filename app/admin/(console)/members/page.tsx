"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Pencil, UserPlus } from "lucide-react";
import { useResource } from "@/lib/client/api";
import { useDebounced } from "@/lib/client/use-debounced";
import { downloadCsv } from "@/lib/csv";
import { lastSeen, fmtDate } from "@/lib/format";
import { STATUS_TEXT, STATUS_TONE, type MemberStatus } from "@/lib/client/labels";
import { useStaff } from "@/components/admin/staff-session";
import { MemberFormDialog, type EditableMember, type PlanOption } from "@/components/admin/member-form-dialog";
import { Button, IconButton, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { SearchField, SelectField } from "@/components/ui/form";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { DataList } from "@/components/ui/data-list";

interface MemberRow extends EditableMember {
  membershipPlan: { id: string; name: string } | null;
  lastCheckIn: string | null;
  createdAt: string;
}

function MembersInner() {
  const params = useSearchParams();
  const { can } = useStaff();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [planId, setPlanId] = useState("");
  const [editing, setEditing] = useState<EditableMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const debouncedQ = useDebounced(q);

  const query = new URLSearchParams();
  if (debouncedQ) query.set("q", debouncedQ);
  if (status) query.set("status", status);
  if (planId) query.set("planId", planId);
  const members = useResource<{ items: MemberRow[]; nextCursor: string | null }>(`/api/members?${query.toString()}`);
  const plans = useResource<PlanOption[]>("/api/plans");
  const filtered = Boolean(debouncedQ || status || planId);

  const exportCsv = (rows: MemberRow[]) =>
    downloadCsv("members.csv", rows, [
      { header: "Name", value: (m) => m.name },
      { header: "Email", value: (m) => m.email },
      { header: "Status", value: (m) => STATUS_TEXT[m.status] },
      { header: "Plan", value: (m) => m.membershipPlan?.name ?? "" },
      { header: "Member since", value: (m) => fmtDate(m.createdAt) },
      { header: "Last visit", value: (m) => lastSeen(m.lastCheckIn) },
    ]);

  return (
    <>
      <PageHeader
        title="Members"
        description="Everyone with a current or past membership. Archived members are hidden."
        actions={
          <>
            <Button variant="secondary" onClick={() => members.data && exportCsv(members.data.items)} disabled={!members.data?.items.length}>
              <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
            {can("members:write") ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" /> Add member
              </Button>
            ) : null}
          </>
        }
      />

      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_12rem_12rem]">
          <SearchField label="Search members" placeholder="Search by name or email" value={q} onChange={setQ} />
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="[&>label]:sr-only">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_TEXT) as MemberStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_TEXT[s]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)} wrapperClassName="[&>label]:sr-only">
            <option value="">All plans</option>
            {plans.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </div>

        <AsyncBlock loading={members.loading} error={members.error} data={members.data} onRetry={members.reload} loadingLabel="Loading members">
          {(data) =>
            data.items.length === 0 ? (
              <div className="p-4">
                {filtered ? (
                  <EmptyState title="No members match">Try a different name, or clear the filters.</EmptyState>
                ) : (
                  <EmptyState title="No members yet" action={can("members:write") ? <Button onClick={() => setDialogOpen(true)}>Add the first member</Button> : undefined} />
                )}
              </div>
            ) : (
              <DataList
                caption="Members"
                rows={data.items}
                rowKey={(m) => m.id}
                columns={[
                  {
                    header: "Member",
                    primary: true,
                    cell: (m) => (
                      <div className="min-w-0">
                        <Link href={`/admin/members/${m.id}`} className="font-medium text-ink hover:text-plate">
                          {m.name ?? m.email}
                        </Link>
                        <p className="truncate text-sm text-ink-soft">{m.email}</p>
                      </div>
                    ),
                  },
                  { header: "Status", cell: (m) => <StatusTag tone={STATUS_TONE[m.status]}>{STATUS_TEXT[m.status]}</StatusTag> },
                  { header: "Plan", cell: (m) => m.membershipPlan?.name ?? <span className="text-ink-soft">None</span> },
                  { header: "Last visit", cell: (m) => <span className="tabular">{lastSeen(m.lastCheckIn)}</span> },
                ]}
                actions={
                  can("members:write")
                    ? (m) => (
                        <IconButton
                          label={`Edit ${m.name ?? m.email}`}
                          onClick={() => {
                            setEditing(m);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )
                    : undefined
                }
              />
            )
          }
        </AsyncBlock>
        {members.data?.nextCursor ? <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">Showing the first 200. Narrow the search to find someone specific.</p> : null}
      </Panel>

      <MemberFormDialog open={dialogOpen} member={editing} plans={plans.data ?? []} onClose={() => setDialogOpen(false)} onSaved={members.reload} />
    </>
  );
}

export default function MembersPage() {
  return (
    <Suspense>
      <MembersInner />
    </Suspense>
  );
}
