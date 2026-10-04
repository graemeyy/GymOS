"use client";

import { useEffect } from "react";
import { useResource } from "@/lib/client/api";
import { fmtTime } from "@/lib/format";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";

interface Row {
  id: string;
  location: string;
  timestamp: string;
  member: { id: string; name: string | null };
}

// Live feed of entries from the front desk and door gateways. Refused scans
// are in the audit log rather than here.
export default function AccessPage() {
  const feed = useResource<Row[]>("/api/check-in");
  const { reload } = feed;
  useEffect(() => {
    const t = setInterval(() => void reload(), 10_000);
    return () => clearInterval(t);
  }, [reload]);

  return (
    <>
      <PageHeader title="Door access" description="The latest entries from the front desk and door scanners. Updates every 10 seconds." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <Panel aria-labelledby="feed-heading">
          <PanelHeader id="feed-heading" title="Latest entries" />
          <AsyncBlock loading={feed.loading} error={feed.error} data={feed.data} onRetry={feed.reload}>
            {(rows) =>
              rows.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No entries yet" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="font-medium">{r.member.name ?? "Unnamed member"}</p>
                        <p className="text-sm text-ink-soft">{r.location}</p>
                      </div>
                      <span className="tabular text-sm text-ink-soft">{fmtTime(r.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </AsyncBlock>
        </Panel>
        <Panel aria-labelledby="gateway-heading" className="h-fit">
          <PanelHeader id="gateway-heading" title="Connecting a door scanner" />
          <div className="space-y-2 px-4 py-3 text-sm">
            <p>
              Scanners send <code className="rounded bg-sunken px-1">POST /api/iot/checkin</code> with the member ID and a bearer token.
            </p>
            <p className="text-ink-soft">The token is IOT_GATEWAY_SECRET in the server environment. If it isn&apos;t set, every scan is refused.</p>
          </div>
        </Panel>
      </div>
    </>
  );
}
