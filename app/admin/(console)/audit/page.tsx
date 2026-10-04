"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/format";
import { Button, PageHeader, Panel } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/form";
import { DataList } from "@/components/ui/data-list";
import { auditChanges, formatAuditValue } from "@/lib/audit-log/changes";

interface Entry {
  id: string;
  staffName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  before: unknown;
  after: unknown;
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
  ["role.", "Roles and permissions"],
  ["plan.", "Plans and prices"],
  ["product.", "Shop products and prices"],
  ["order.", "Shop orders"],
  ["class.", "Classes and bookings"],
  ["settings.", "Settings"],
  ["finance.", "Finance exports"],
  ["audit.", "Audit log exports"],
];

// Old and new values, for entries that record them (PR 6 onwards).
function Changes({ entry }: { entry: Entry }) {
  const changes = auditChanges(entry.before, entry.after);
  if (changes.length === 0) return null;
  return (
    <details className="mt-1 text-sm">
      <summary className="cursor-pointer text-plate underline underline-offset-2">
        {changes.length === 1 ? "1 change" : `${changes.length} changes`}
      </summary>
      <dl className="mt-1 space-y-1">
        {changes.map((c) => (
          <div key={c.field}>
            <dt className="font-medium">{c.field}</dt>
            <dd className="break-words text-ink-soft">
              <span className="line-through decoration-bad">{formatAuditValue(c.before)}</span>
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> changed to </span>
              <span className="text-ink">{formatAuditValue(c.after)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

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
  const toast = useToast();
  const [action, setAction] = useState("");
  const [staffId, setStaffId] = useState("");
  const people = useResource<{ id: string; name: string }[]>("/api/staff/directory");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams({ take: "50" });
  if (action) params.set("action", action);
  if (staffId) params.set("staffId", staffId);
  // Plain dates: the server reads them as whole gym-local days (R-108).
  if (from) params.set("from", from);
  if (to) params.set("to", to);
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
    } catch (e) {
      // Previously unhandled: the button just stopped spinning (R-93).
      toast(e instanceof ApiClientError ? e.message : "Couldn't load more entries. Try again.", "bad");
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
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Area" value={action} onChange={(e) => setAction(e.target.value)}>
            {AREAS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Who" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Anyone</option>
            {(people.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
                          <Changes entry={e} />
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
