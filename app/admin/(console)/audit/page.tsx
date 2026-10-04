"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { api, useResource } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/client/format";
import { Button, PageHeader, Panel } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/form";
import { DataList } from "@/components/ui/data-list";

interface Entry {
  id: string;
  staffName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
interface Page {
  items: Entry[];
  nextCursor: string | null;
}

const AREAS: [string, string][] = [
  ["", "Everything"],
  ["billing.", "Payments and refunds"],
  ["membership.", "Plan changes, pauses and cancellations"],
  ["member.", "Member records and check-ins"],
  ["staff.", "Staff accounts and sign-ins"],
  ["plan.", "Plans and prices"],
  ["order.", "Shop orders"],
  ["class.", "Classes and bookings"],
  ["settings.", "Settings"],
  ["finance.", "Finance exports"],
];

function describe(action: string) {
  const [noun, verb = ""] = action.split(".");
  return `${noun.replace(/_/g, " ")}: ${verb.replace(/_/g, " ")}`;
}

function detailText(d: Record<string, unknown> | null) {
  if (!d) return "";
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");
}

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams({ take: "50" });
  if (action) params.set("action", action);
  if (from) params.set("from", `${from}T00:00:00`);
  if (to) params.set("to", `${to}T23:59:59`);
  const query = params.toString();
  const first = useResource<Page>(`/api/audit-log?${query}`);
  const [more, setMore] = useState<{ query: string; items: Entry[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more?.query === query ? more : null;
  const next = extra ? extra.cursor : first.data?.nextCursor;

  const loadMore = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await api<Page>(`/api/audit-log?${query}&cursor=${encodeURIComponent(next)}`);
      setMore({ query, items: [...(extra?.items ?? []), ...page.items], cursor: page.nextCursor });
    } finally {
      setLoadingMore(false);
    }
  };

  const exportParams = new URLSearchParams(params);
  exportParams.delete("take");

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, newest first. Entries can't be edited or deleted."
        actions={
          <a href={`/api/audit-log/export?${exportParams.toString()}`} download className="inline-flex min-h-tap items-center gap-2 rounded border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-sunken">
            <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
          <SelectField label="Area" value={action} onChange={(e) => setAction(e.target.value)}>
            {AREAS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <AsyncBlock loading={first.loading} error={first.error} data={first.data} onRetry={first.reload}>
          {(data) => {
            const rows = [...data.items, ...(extra?.items ?? [])];
            return rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Nothing matches" />
              </div>
            ) : (
              <>
                <DataList
                  caption="Audit log"
                  rows={rows}
                  rowKey={(e) => e.id}
                  columns={[
                    {
                      header: "What",
                      primary: true,
                      cell: (e) => (
                        <div>
                          <p className="font-medium first-letter:uppercase">{describe(e.action)}</p>
                          {detailText(e.details) ? <p className="text-sm text-ink-soft">{detailText(e.details)}</p> : null}
                        </div>
                      ),
                    },
                    { header: "Who", cell: (e) => e.staffName },
                    { header: "When", cell: (e) => <span className="tabular">{fmtDateTime(e.createdAt)}</span> },
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
