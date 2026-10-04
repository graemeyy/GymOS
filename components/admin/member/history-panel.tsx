"use client";

import { useEffect } from "react";
import { useResource } from "@/lib/client/api";
import { fmtDate } from "@/lib/client/format";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";

interface Event {
  id: string;
  type: string;
  effectiveAt: string;
  details: Record<string, unknown> | null;
  actorName: string;
}

const TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  JOINED: () => "Joined",
  PLAN_CHANGED: (d) => `Plan changed${d.from ? ` from ${d.from}` : ""} to ${d.to}`,
  PLAN_CHANGE_SCHEDULED: (d) => `Plan change to ${d.to} booked for the next billing date`,
  PAUSE_SCHEDULED: (d) => `Pause booked until ${d.until ? fmtDate(String(d.until)) : "a set date"}`,
  RESUMED: () => "Resumed",
  CANCEL_REQUESTED: (d) => `Cancellation requested${d.reason ? `: ${d.reason}` : ""}`,
  CANCEL_WITHDRAWN: () => "Cancellation withdrawn",
  CANCELLED: (d) => `Cancelled${d.reason ? `: ${d.reason}` : ""}`,
};

// `version` goes up when the membership changes elsewhere on the page, so
// this panel reloads instead of showing stale history (R-55).
export function HistoryPanel({ memberId, version = 0 }: { memberId: string; version?: number }) {
  const events = useResource<Event[]>(`/api/members/${memberId}/events`);
  const { reload } = events;
  useEffect(() => {
    if (version > 0) void reload();
  }, [version, reload]);
  return (
    <Panel aria-labelledby="history-heading">
      <PanelHeader id="history-heading" title="Membership history" />
      <AsyncBlock loading={events.loading} error={events.error} data={events.data} onRetry={events.reload}>
        {(rows) =>
          rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nothing recorded yet" />
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {rows.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{(TEXT[e.type] ?? (() => e.type))(e.details ?? {})}</p>
                    <p className="text-sm text-ink-soft">{e.actorName}</p>
                  </div>
                  <span className="tabular shrink-0 text-sm text-ink-soft">{fmtDate(e.effectiveAt)}</span>
                </li>
              ))}
            </ol>
          )
        }
      </AsyncBlock>
    </Panel>
  );
}
