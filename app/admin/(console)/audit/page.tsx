"use client";

import { useState } from "react";
import { api, useResource } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/client/format";
import { Button, PageHeader, Panel } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { DataList } from "@/components/ui/data-list";

interface Entry {
  id: string;
  staffName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
}
interface Page {
  items: Entry[];
  nextCursor: string | null;
}

function describe(action: string) {
  const [noun, verb = ""] = action.split(".");
  return `${noun.replace(/_/g, " ")}: ${verb.replace(/_/g, " ")}`;
}

export default function AuditPage() {
  const first = useResource<Page>("/api/audit-log?take=50");
  const [more, setMore] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const next = cursor === undefined ? first.data?.nextCursor : cursor;

  const loadMore = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await api<Page>(`/api/audit-log?take=50&cursor=${encodeURIComponent(next)}`);
      setMore((m) => [...m, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader title="Audit log" description="Who changed what, newest first. Entries can't be edited or deleted." />
      <Panel>
        <AsyncBlock loading={first.loading} error={first.error} data={first.data} onRetry={first.reload}>
          {(data) => {
            const rows = [...data.items, ...more];
            return rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Nothing logged yet" />
              </div>
            ) : (
              <>
                <DataList
                  caption="Audit log"
                  rows={rows}
                  rowKey={(e) => e.id}
                  columns={[
                    { header: "What", primary: true, cell: (e) => <span className="font-medium first-letter:uppercase">{describe(e.action)}</span> },
                    { header: "Who", cell: (e) => e.staffName },
                    { header: "When", cell: (e) => <span className="tabular">{fmtDateTime(e.createdAt)}</span> },
                    { header: "Record", cell: (e) => <span className="text-ink-soft">{e.targetType}</span> },
                  ]}
                />
                {next ? (
                  <div className="border-t border-line p-4">
                    <Button variant="secondary" busy={loadingMore} onClick={loadMore}>
                      Show older entries
                    </Button>
                  </div>
                ) : null}
              </>
            );
          }}
        </AsyncBlock>
      </Panel>
    </>
  );
}
