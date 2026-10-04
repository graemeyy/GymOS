"use client";

import Link from "next/link";
import { Download, Mail } from "lucide-react";
import { useResource } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import { daysSince, lastSeen } from "@/lib/client/format";
import { PageHeader, Panel, StatusTag, Button } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { DataList } from "@/components/ui/data-list";
import { Scoreboard } from "@/components/ui/scoreboard";

interface Row {
  id: string;
  name: string | null;
  email: string;
  retentionScore: number;
  lastCheckIn: string | null;
  membershipPlan: { name: string } | null;
}

function band(score: number) {
  if (score < 40) return { label: "Likely to leave", tone: "bad" as const };
  if (score < 70) return { label: "Keep an eye on", tone: "warn" as const };
  return { label: "Regular", tone: "good" as const };
}

export default function RetentionPage() {
  const members = useResource<{ items: Row[] }>("/api/members?status=ACTIVE&take=500");
  const rows = [...(members.data?.items ?? [])].sort((a, b) => a.retentionScore - b.retentionScore);
  const atRisk = rows.filter((m) => m.retentionScore < 40);
  const quiet = rows.filter((m) => (daysSince(m.lastCheckIn) ?? 999) >= 14);

  return (
    <>
      <PageHeader
        title="Retention"
        description="Active members ranked by how likely they are to stop coming. The score updates overnight from visits and class no-shows."
        actions={
          <Button
            variant="secondary"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv("retention.csv", rows, [
                { header: "Name", value: (m) => m.name },
                { header: "Email", value: (m) => m.email },
                { header: "Plan", value: (m) => m.membershipPlan?.name ?? "" },
                { header: "Score", value: (m) => m.retentionScore },
                { header: "Last visit", value: (m) => lastSeen(m.lastCheckIn) },
              ])
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
          </Button>
        }
      />
      <Scoreboard
        label="Retention summary"
        items={[
          { label: "Likely to leave", value: members.data ? String(atRisk.length) : null, tone: atRisk.length > 0 ? "alert" : "neutral" },
          { label: "No visit in 14+ days", value: members.data ? String(quiet.length) : null, tone: quiet.length > 0 ? "alert" : "neutral" },
          { label: "Active members", value: members.data ? String(rows.length) : null },
          { label: "Average score", value: rows.length ? String(Math.round(rows.reduce((s, m) => s + m.retentionScore, 0) / rows.length)) : members.data ? "0" : null },
        ]}
      />
      <Panel className="mt-6">
        <AsyncBlock loading={members.loading} error={members.error} data={members.data} onRetry={members.reload}>
          {() =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No active members to assess" />
              </div>
            ) : (
              <DataList
                caption="Members by retention score"
                rows={rows.slice(0, 50)}
                rowKey={(m) => m.id}
                columns={[
                  {
                    header: "Member",
                    primary: true,
                    cell: (m) => (
                      <Link href={`/admin/members/${m.id}`} className="font-medium hover:text-plate">
                        {m.name ?? m.email}
                      </Link>
                    ),
                  },
                  { header: "Score", align: "right", cell: (m) => <span className="tabular font-medium">{m.retentionScore}</span> },
                  { header: "Band", cell: (m) => <StatusTag tone={band(m.retentionScore).tone}>{band(m.retentionScore).label}</StatusTag> },
                  { header: "Last visit", cell: (m) => lastSeen(m.lastCheckIn) },
                ]}
                actions={(m) => (
                  <a href={`mailto:${m.email}`} aria-label={`Email ${m.name ?? m.email}`} className="inline-flex h-tap w-tap items-center justify-center rounded text-ink-soft hover:bg-sunken hover:text-ink">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              />
            )
          }
        </AsyncBlock>
      </Panel>
    </>
  );
}
