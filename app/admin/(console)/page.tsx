"use client";

import Link from "next/link";
import { useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { fmtTime } from "@/lib/client/format";
import { EQUIPMENT_TEXT, EQUIPMENT_TONE, STATUS_TEXT, STATUS_TONE, type MemberStatus } from "@/lib/client/labels";
import { useStaff } from "@/components/admin/staff-session";
import { PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Scoreboard } from "@/components/ui/scoreboard";

interface Stats {
  activeMembers: number;
  checkInsToday: number;
  pastDue: number;
  atRisk: number;
  equipmentAlerts: number;
  mrrCents: number | null;
}
interface CheckInRow {
  id: string;
  location: string;
  timestamp: string;
  member: { id: string; name: string | null; status: MemberStatus };
}
interface EquipmentRow {
  id: string;
  name: string;
  status: keyof typeof EQUIPMENT_TEXT;
  partNeeded: string | null;
}

export default function DashboardPage() {
  const { can, me } = useStaff();
  const stats = useResource<Stats>("/api/dashboard/stats");
  const checkIns = useResource<CheckInRow[]>(can("checkin:scan") ? "/api/check-in" : null);
  const equipment = useResource<EquipmentRow[]>(can("equipment:read") ? "/api/equipment" : null);
  const s = stats.data;

  return (
    <>
      <PageHeader title="Today" description={me ? `Signed in as ${me.name}.` : undefined} />

      {stats.error ? (
        <ErrorState message={stats.error.message} onRetry={stats.reload} />
      ) : (
        <Scoreboard
          label="Today's numbers"
          items={[
            { label: "Check-ins today", value: s ? String(s.checkInsToday) : null },
            { label: "Active members", value: s ? String(s.activeMembers) : null },
            { label: "Payments overdue", value: s ? String(s.pastDue) : null, tone: "alert", href: "/admin/members?status=PAST_DUE" },
            s?.mrrCents !== null
              ? { label: "Monthly revenue (est.)", value: s ? formatAud(s.mrrCents ?? 0, { whole: true }) : null, note: "From current plan prices" }
              : { label: "At risk of leaving", value: s ? String(s.atRisk) : null, tone: "alert", href: "/admin/retention" },
          ]}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {can("checkin:scan") ? (
          <Panel aria-labelledby="recent-checkins">
            <PanelHeader
              id="recent-checkins"
              title="Recent check-ins"
              action={
                <Link href="/admin/check-in" className="rounded text-sm font-medium text-plate underline-offset-2 hover:underline">
                  Open check-in
                </Link>
              }
            />
            <AsyncBlock loading={checkIns.loading} error={checkIns.error} data={checkIns.data} onRetry={checkIns.reload}>
              {(rows) =>
                rows.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No check-ins yet today" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {rows.slice(0, 8).map((ci) => (
                      <li key={ci.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <Link href={`/admin/members/${ci.member.id}`} className="truncate font-medium hover:text-plate">
                            {ci.member.name ?? "Unnamed member"}
                          </Link>
                          <p className="tabular text-sm text-ink-soft">
                            {fmtTime(ci.timestamp)}, {ci.location}
                          </p>
                        </div>
                        <StatusTag tone={STATUS_TONE[ci.member.status]}>{STATUS_TEXT[ci.member.status]}</StatusTag>
                      </li>
                    ))}
                  </ul>
                )
              }
            </AsyncBlock>
          </Panel>
        ) : null}

        {can("equipment:read") ? (
          <Panel aria-labelledby="equipment-heading">
            <PanelHeader
              id="equipment-heading"
              title="Equipment needing attention"
              action={
                <Link href="/admin/equipment" className="rounded text-sm font-medium text-plate underline-offset-2 hover:underline">
                  All equipment
                </Link>
              }
            />
            <AsyncBlock loading={equipment.loading} error={equipment.error} data={equipment.data} onRetry={equipment.reload}>
              {(rows) => {
                const flagged = rows.filter((e) => e.status !== "OPERATIONAL");
                return flagged.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="Everything is working" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {flagged.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium">{e.name}</p>
                          {e.partNeeded ? <p className="text-sm text-ink-soft">Needs: {e.partNeeded}</p> : null}
                        </div>
                        <StatusTag tone={EQUIPMENT_TONE[e.status]}>{EQUIPMENT_TEXT[e.status]}</StatusTag>
                      </li>
                    ))}
                  </ul>
                );
              }}
            </AsyncBlock>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
