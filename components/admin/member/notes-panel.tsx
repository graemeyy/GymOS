"use client";

import React, { useState } from "react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/client/format";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { FormMessage, TextareaField } from "@/components/ui/form";
import { useStaff } from "@/components/admin/staff-session";

interface Note {
  id: string;
  staffName: string;
  body: string;
  createdAt: string;
}

export function NotesPanel({ memberId, archived }: { memberId: string; archived: boolean }) {
  const { can } = useStaff();
  const notes = useResource<Note[]>(`/api/members/${memberId}/notes`);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/members/${memberId}/notes`, { body: { body } });
      setBody("");
      void notes.reload();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.fields.body ?? e.message : "Couldn't save the note.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel aria-labelledby="notes-heading">
      <PanelHeader id="notes-heading" title="Staff notes" />
      {can("members:write") && !archived ? (
        <form onSubmit={add} className="space-y-3 border-b border-line px-4 py-3">
          <TextareaField label="Add a note" rows={2} value={body} hint="Staff only. Don't record health details unless the member has agreed." onChange={(e) => setBody(e.target.value)} />
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Button type="submit" variant="secondary" busy={busy} disabled={!body.trim()}>
            Save note
          </Button>
        </form>
      ) : null}
      <AsyncBlock loading={notes.loading} error={notes.error} data={notes.data} onRetry={notes.reload}>
        {(rows) =>
          rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No notes yet" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {n.staffName}, <span className="tabular">{fmtDateTime(n.createdAt)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncBlock>
    </Panel>
  );
}
