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
import { BarList, DayColumns } from "@/components/ui/bar-list";

interface Stats {
  activeMembers: number;
  newSignups30: number;
  cancellations30: number;
  churnRate30: number;
  checkInsToday: number;
  checkIns7: { date: string; count: number }[];
  pastDue: number;
  owingCents: number | null;
  atRisk: number;
  equipmentAlerts: number;
  openOrders: number;
  mrrCents: number | null;
  revenue: null | { mrrCents: number; last30Cents: number; byPlan: { name: string; cents: number }[]; byProduct: { name: string; cents: number }[] };
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
            { label: "Payments overdue", value: s ? String(s.pastDue) : null, tone: s && s.pastDue > 0 ? "alert" : "neutral", href: "/admin/members?status=PAST_DUE" },
            s?.mrrCents !== null
              ? { label: "Monthly revenue (est.)", value: s ? formatAud(s.mrrCents ?? 0, { whole: true }) : null, note: "From current plan prices" }
              : { label: "At risk of leaving", value: s ? String(s.atRisk) : null, tone: s && s.atRisk > 0 ? "alert" : "neutral", href: "/admin/retention" },
          ]}
        />
      )}

      {s ? (
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          {[
            ["New sign-ups, 30 days", String(s.newSignups30)],
            ["Cancellations, 30 days", String(s.cancellations30)],
            ["Churn, 30 days", `${s.churnRate30}%`],
            s.owingCents !== null ? ["Owed by overdue members", formatAud(s.owingCents)] : ["Open shop orders", String(s.openOrders)],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-3">
              <dt className="text-sm text-ink-soft">{label}</dt>
              <dd className="tabular font-display text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {s ? (
          <Panel aria-labelledby="week-heading">
            <PanelHeader id="week-heading" title="Check-ins this week" />
            <DayColumns days={s.checkIns7} />
          </Panel>
        ) : null}
        {s?.revenue ? (
          <Panel aria-labelledby="revenue-heading">
            <PanelHeader
              id="revenue-heading"
              title="Revenue, last 30 days"
              action={<span className="tabular text-sm font-medium">{formatAud(s.revenue.last30Cents)}</span>}
            />
            <h3 className="px-4 pt-3 text-sm font-medium text-ink-soft">By plan</h3>
            <BarList rows={s.revenue.byPlan.map((r) => ({ name: r.name, value: r.cents }))} empty="No membership payments yet." />
            <h3 className="border-t border-line px-4 pt-3 text-sm font-medium text-ink-soft">By product</h3>
            <BarList rows={s.revenue.byProduct.map((r) => ({ name: r.name, value: r.cents }))} empty="No shop sales yet." />
          </Panel>
        ) : null}
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
