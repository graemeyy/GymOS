"use client";

import React, { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { downloadCsv } from "@/lib/csv";
import { IMPORT_FIELDS, IMPORT_KIND_TEXT, IMPORT_KINDS, type ImportKind } from "@/lib/import/fields";
import { Button, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { FormMessage, SelectField } from "@/components/ui/form";

const MAX_BYTES = 2 * 1024 * 1024;

interface Preview {
  headers: string[];
  sample: string[][];
  rowCount: number;
  mapping: Record<string, number | null>;
}
interface Problem {
  line: number;
  field: string;
  value: string;
  message: string;
}
interface DryRun {
  kind: ImportKind;
  total: number;
  readyCount: number;
  preview: Record<string, string>[];
  skippedCount: number;
  skipped: { line: number; reason: string }[];
  problemCount: number;
  problems: Problem[];
  confirm: string | null;
}
interface RunResult {
  kind: ImportKind;
  imported: number;
  skipped: number;
  invites: { status: "sending" | "not_sent"; count: number; previewLinks: { email: string; link: string }[] } | null;
}

const NOUN: Record<ImportKind, [string, string]> = { members: ["member", "members"], plans: ["plan", "plans"], memberships: ["membership", "memberships"] };
const count = (n: number, kind: ImportKind) => `${n.toLocaleString("en-AU")} ${NOUN[kind][n === 1 ? 0 : 1]}`;

// Bringing members, plans and memberships across from another system
// (D-130, D-131): choose a file, match its columns, check it, then import.
export default function ImportPage() {
  const toast = useToast();
  const [kind, setKind] = useState<ImportKind>("members");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [done, setDone] = useState<RunResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const invites = useResource<{ awaitingPassword: number; emailConfigured: boolean }>("/api/import/invites");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setDryRun(null);
    setDone(null);
    setFileError(null);
    if (input.current) input.current.value = "";
  };

  const load = useMutation((body: { kind: ImportKind; fileName: string; csv: string }) => api<Preview>("/api/import/preview", { body }), {
    onSuccess: (p) => {
      setPreview(p);
      setMapping(p.mapping);
    },
    onError: (e) => setFileError(e.message),
  });
  const check = useMutation(() => api<DryRun>("/api/import/dry-run", { body: { kind, fileName: file!.name, csv: file!.text, mapping } }), { onSuccess: setDryRun });
  const run = useMutation(() => api<RunResult>("/api/import/run", { body: { kind, fileName: file!.name, csv: file!.text, mapping, confirm: dryRun!.confirm } }), {
    onSuccess: (result) => {
      setDone(result);
      toast(`Imported ${count(result.imported, result.kind)}`);
      void invites.reload();
    },
    onError: (e) => toast(e.message, "bad"),
  });
  const resend = useMutation(() => api<{ count: number }>("/api/import/invites", { method: "POST" }), {
    onSuccess: (r) => toast(`Sending ${r.count} invitation${r.count === 1 ? "" : "s"}`),
    onError: (e) => toast(e.message, "bad"),
  });

  const choose = async (chosen: File | undefined) => {
    setFileError(null);
    setPreview(null);
    setDryRun(null);
    setDone(null);
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) return setFileError("The file is over 2 MB. Split it into smaller files.");
    const text = await chosen.text();
    setFile({ name: chosen.name, text });
    void load.run({ kind, fileName: chosen.name, csv: text });
  };

  const template = () => downloadCsv(`${kind}-template.csv`, [], IMPORT_FIELDS[kind].map((f) => ({ header: f.label, value: () => "" })));
  const errorReport = (d: DryRun) =>
    downloadCsv(`${kind}-import-problems.csv`, d.problems, [
      { header: "Line", value: (p) => p.line },
      { header: "Column", value: (p) => p.field },
      { header: "Value", value: (p) => p.value },
      { header: "Problem", value: (p) => p.message },
    ]);

  const fields = IMPORT_FIELDS[kind];
  const step = done ? 4 : dryRun ? 3 : preview ? 2 : 1;

  return (
    <>
      <PageHeader title="Import" description="Bring members, plans and memberships across from another system with CSV files. Import plans first, then members, then memberships." />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel aria-labelledby="step-file">
            <PanelHeader id="step-file" title="1. Choose what to import" />
            <div className="space-y-4 p-4">
              <fieldset disabled={step > 1 && !done}>
                <legend className="sr-only">What&apos;s in the file</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {IMPORT_KINDS.map((k) => (
                    <label key={k} className={`flex cursor-pointer flex-col gap-1 rounded border p-3 ${kind === k ? "border-plate bg-plate-tint" : "border-line"}`}>
                      <span className="flex items-center gap-2 font-medium">
                        <input
                          type="radio"
                          name="kind"
                          className="h-5 w-5 accent-plate"
                          checked={kind === k}
                          onChange={() => {
                            reset();
                            setKind(k);
                          }}
                        />
                        {IMPORT_KIND_TEXT[k].title}
                      </span>
                      <span className="text-sm text-ink-soft">{IMPORT_KIND_TEXT[k].description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="import-file" className="block text-sm font-medium">
                    CSV file
                  </label>
                  <input
                    id="import-file"
                    ref={input}
                    type="file"
                    accept=".csv,text/csv"
                    aria-describedby="import-file-hint"
                    onChange={(e) => void choose(e.target.files?.[0])}
                    className="block w-full text-sm file:mr-3 file:min-h-tap file:rounded file:border file:border-line-strong file:bg-surface file:px-3 file:font-medium"
                  />
                  <p id="import-file-hint" className="text-sm text-ink-soft">
                    Up to 2 MB and 5,000 rows, with column headings in the first row. Save spreadsheets as CSV first.
                  </p>
                </div>
                <Button variant="secondary" onClick={template}>
                  <Download className="h-4 w-4" aria-hidden="true" /> Template
                </Button>
              </div>
              {kind === "memberships" ? (
                <p className="rounded bg-sunken px-3 py-2 text-sm">
                  Card details are never imported. Each member adds a card through Stripe when they sign in, and is first charged the day after their paid-until date.
                </p>
              ) : null}
              {fileError ? <FormMessage>{fileError}</FormMessage> : null}
              {load.busy ? <p className="text-sm text-ink-soft">Reading the file…</p> : null}
            </div>
          </Panel>

          {preview && !done ? (
            <Panel aria-labelledby="step-map">
              <PanelHeader id="step-map" title="2. Match the columns" />
              <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">
                {file?.name}: {preview.rowCount.toLocaleString("en-AU")} rows. Choose which column holds each detail. The example is from the first row.
              </p>
              <ul className="divide-y divide-line">
                {fields.map((f) => {
                  const column = mapping[f.key];
                  const example = column === null || column === undefined ? "" : (preview.sample[0]?.[column] ?? "");
                  return (
                    <li key={f.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_16rem] sm:items-start">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {f.label} {f.required ? <span className="text-sm font-normal text-ink-soft">(required)</span> : null}
                        </p>
                        <p className="text-sm text-ink-soft">{f.hint}</p>
                        {example ? <p className="mt-1 truncate text-sm">Example: {example}</p> : null}
                      </div>
                      <SelectField
                        label={`Column for ${f.label.toLowerCase()}`}
                        wrapperClassName="[&>label]:sr-only"
                        value={column === null || column === undefined ? "" : String(column)}
                        error={check.fields[f.key]}
                        disabled={Boolean(dryRun)}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                      >
                        <option value="">Not in this file</option>
                        {preview.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </SelectField>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-3 border-t border-line p-4">
                {dryRun ? (
                  <Button variant="secondary" onClick={() => setDryRun(null)}>
                    Change the columns
                  </Button>
                ) : (
                  <Button busy={check.busy} onClick={() => void check.run()}>
                    Check the file
                  </Button>
                )}
                <span className="text-sm text-ink-soft">A dry run: it checks every row and changes nothing.</span>
              </div>
              {check.error && !dryRun ? (
                <div className="px-4 pb-4">
                  <FormMessage>{check.error}</FormMessage>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {dryRun && !done ? <DryRunPanel dryRun={dryRun} onReport={() => errorReport(dryRun)} onImport={() => void run.run()} busy={run.busy} onRestart={reset} /> : null}

          {done ? (
            <Panel aria-labelledby="step-done">
              <PanelHeader id="step-done" title="Imported" />
              <div className="space-y-3 p-4">
                <p>
                  {count(done.imported, done.kind)} imported{done.skipped ? `, ${done.skipped.toLocaleString("en-AU")} already here and left as they were` : ""}. The audit log has a record of it.
                </p>
                {done.invites ? <InviteNote invites={done.invites} /> : null}
                <Button variant="secondary" onClick={reset}>
                  <FileUp className="h-4 w-4" aria-hidden="true" /> Import another file
                </Button>
              </div>
            </Panel>
          ) : null}
        </div>

        <Panel aria-labelledby="invites-heading" className="h-fit">
          <PanelHeader id="invites-heading" title="Invitations" />
          <div className="space-y-3 p-4 text-sm">
            {invites.data ? (
              <>
                <p>
                  {invites.data.awaitingPassword === 0
                    ? "Every imported member has set a password."
                    : `${invites.data.awaitingPassword.toLocaleString("en-AU")} imported member${invites.data.awaitingPassword === 1 ? " hasn't" : "s haven't"} set a password yet.`}
                </p>
                {invites.data.awaitingPassword > 0 ? (
                  invites.data.emailConfigured ? (
                    <Button variant="secondary" busy={resend.busy} onClick={() => void resend.run()}>
                      Send their invitations again
                    </Button>
                  ) : (
                    <p className="text-ink-soft">Email isn&apos;t set up, so invitations can&apos;t be sent yet. Members can also use &quot;Forgot password&quot; on the sign-in page.</p>
                  )
                ) : null}
              </>
            ) : (
              <p className="text-ink-soft">Loading…</p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function DryRunPanel({ dryRun, onReport, onImport, busy, onRestart }: { dryRun: DryRun; onReport: () => void; onImport: () => void; busy: boolean; onRestart: () => void }) {
  const columns = dryRun.preview[0] ? Object.keys(dryRun.preview[0]) : [];
  return (
    <Panel aria-labelledby="step-check">
      <PanelHeader id="step-check" title="3. Check and import" />
      <div className="space-y-4 p-4">
        <ul className="flex flex-wrap gap-2" aria-label="Dry run results">
          <li>
            <StatusTag tone="good">{count(dryRun.readyCount, dryRun.kind)} ready</StatusTag>
          </li>
          {dryRun.skippedCount ? (
            <li>
              <StatusTag>{dryRun.skippedCount.toLocaleString("en-AU")} already here</StatusTag>
            </li>
          ) : null}
          <li>
            <StatusTag tone={dryRun.problemCount ? "bad" : "good"}>
              {dryRun.problemCount ? `${dryRun.problemCount.toLocaleString("en-AU")} problem${dryRun.problemCount === 1 ? "" : "s"}` : "No problems"}
            </StatusTag>
          </li>
        </ul>

        {dryRun.problemCount ? (
          <>
            <p>Nothing has been imported. Fix these in the file (line numbers count the heading row as line 1), then choose it again.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onReport}>
                <Download className="h-4 w-4" aria-hidden="true" /> Download the error report
              </Button>
              <Button variant="ghost" onClick={onRestart}>
                Choose the file again
              </Button>
            </div>
            <Table caption="Problems" columns={["Line", "Column", "Value", "Problem"]} rows={dryRun.problems.slice(0, 50).map((p) => [String(p.line), p.field, p.value, p.message])} />
            {dryRun.problemCount > 50 ? <p className="text-sm text-ink-soft">The first 50 are shown. The error report has them all.</p> : null}
          </>
        ) : null}

        {dryRun.readyCount && !dryRun.problemCount ? (
          <>
            <Table caption={`The first ${Math.min(10, dryRun.readyCount)} to be imported`} columns={columns} rows={dryRun.preview.map((r) => columns.map((c) => r[c]))} />
            {dryRun.kind === "members" ? <p className="text-sm">Each new member gets an email inviting them to set a password. Their card details are added through Stripe when they sign in.</p> : null}
            <Button busy={busy} onClick={onImport} disabled={!dryRun.confirm}>
              Import {count(dryRun.readyCount, dryRun.kind)}
            </Button>
          </>
        ) : null}

        {!dryRun.readyCount && !dryRun.problemCount ? <p>Everything in this file is already here. There&apos;s nothing to import.</p> : null}

        {dryRun.skippedCount ? (
          <details className="text-sm">
            <summary className="min-h-tap cursor-pointer py-2 font-medium">Already here ({dryRun.skippedCount.toLocaleString("en-AU")})</summary>
            <ul className="list-disc space-y-1 pl-5">
              {dryRun.skipped.slice(0, 100).map((s) => (
                <li key={s.line}>
                  Line {s.line}: {s.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Panel>
  );
}

function InviteNote({ invites }: { invites: NonNullable<RunResult["invites"]> }) {
  if (invites.count === 0) return null;
  if (invites.status === "sending") return <p>Invitations to set a password are being emailed to {invites.count.toLocaleString("en-AU")} members. Each link works for 14 days.</p>;
  return (
    <div className="space-y-2">
      <p>Email isn&apos;t set up, so the {invites.count.toLocaleString("en-AU")} invitations weren&apos;t sent. Set up email, then use &quot;Send their invitations again&quot;.</p>
      {invites.previewLinks.length ? (
        <details className="text-sm">
          <summary className="min-h-tap cursor-pointer py-2 font-medium">Invitation links (this copy isn&apos;t live, so they&apos;re shown here)</summary>
          <ul className="space-y-1">
            {invites.previewLinks.map((l) => (
              <li key={l.email} className="break-all">
                {l.email}: <a href={l.link} className="text-plate underline underline-offset-2">set password</a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Table({ caption, columns, rows }: { caption: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded border border-line" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sunken">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


