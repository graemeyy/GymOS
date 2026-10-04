"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { QrScannerDialog } from "@/components/admin/qr-scanner";
import Link from "next/link";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { fmtTime } from "@/lib/format";
import { STATUS_TEXT, STATUS_TONE, type MemberStatus } from "@/lib/client/labels";
import { Button, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/client/cn";
import { AT_RISK_BELOW } from "@/lib/retention";

interface Result {
  granted: boolean;
  reason: string | null;
  warning: string | null;
  method: "MANUAL" | "QR";
  member: { id: string; name: string | null; status: MemberStatus; plan: string | null; retentionScore: number; keycardIssued: boolean };
}
interface RecentRow {
  id: string;
  location: string;
  timestamp: string;
  member: { id: string; name: string | null; status: MemberStatus };
}

// Front-desk check-in. A USB or Bluetooth scanner types the member ID and
// presses Enter, so the input keeps focus after each scan.
export default function CheckInPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recent = useResource<RecentRow[]>("/api/check-in");
  const reloadRecent = recent.reload;
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const checkIn = useCallback(async (query: string) => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<Result>("/api/check-in", { body: { query } });
      setResult(data);
      setValue("");
      void reloadRecent();
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiClientError ? e.message : "Check-in failed.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
      // Selected, so the next scan replaces a failed code instead of being
      // appended to it (R-15).
      inputRef.current?.select();
    }
  }, [reloadRecent]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (value.trim()) void checkIn(value.trim());
  };

  const onScan = useCallback(
    (pass: string) => {
      setCameraOpen(false);
      void checkIn(pass);
    },
    [checkIn]
  );

  return (
    <>
      <PageHeader
        title="Check-in"
        description="Scan a member's QR pass, or type their email."
        actions={
          <Button variant="secondary" onClick={() => setCameraOpen(true)}>
            <Camera className="h-4 w-4" aria-hidden="true" /> Scan with camera
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel className="p-4 sm:p-5">
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="checkin-input" className="block text-sm font-medium">
                  Pass, member ID or email
                </label>
                <input
                  id="checkin-input"
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="block min-h-[56px] w-full rounded border border-line-strong bg-surface px-4 text-lg focus:border-plate focus:outline-none focus:ring-2 focus:ring-plate/30"
                />
              </div>
              <Button type="submit" busy={busy} className="min-h-[56px] px-6 text-base">
                Check in
              </Button>
            </form>
            {error ? (
              <p role="alert" className="mt-3 rounded bg-bad-tint px-3 py-2 text-sm font-medium text-bad">
                {error}
              </p>
            ) : null}
          </Panel>

          {/* Always mounted, so the first result is announced too (R-92). */}
          <div aria-live="assertive">
          {result ? (
            <section className={cn("rounded-lg border-2 p-5", result.granted ? "border-good bg-good-tint" : "border-bad bg-bad-tint")}>
              <p className={cn("font-display text-3xl font-bold", result.granted ? "text-good" : "text-bad")}>
                {result.granted ? "Come on in" : `Not allowed in: ${result.reason}`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link href={`/admin/members/${result.member.id}`} className="text-xl font-medium text-ink hover:text-plate">
                  {result.member.name ?? "Unnamed member"}
                </Link>
                <StatusTag tone={STATUS_TONE[result.member.status]}>{STATUS_TEXT[result.member.status]}</StatusTag>
                {result.member.plan ? <span className="text-ink-soft">{result.member.plan}</span> : null}
              </div>
              {result.warning ? <p className="mt-2 font-medium text-ink">{result.warning}</p> : null}
              {!result.member.keycardIssued ? <p className="mt-2 text-sm text-ink">No keycard issued yet.</p> : null}
              {result.member.retentionScore < AT_RISK_BELOW ? <p className="mt-1 text-sm text-ink">Hasn&apos;t been in much lately. A quick hello helps.</p> : null}
            </section>
          ) : null}
          </div>
        </div>

        <Panel aria-labelledby="recent-heading">
          <PanelHeader id="recent-heading" title="Recent check-ins" />
          <AsyncBlock loading={recent.loading} error={recent.error} data={recent.data} onRetry={recent.reload}>
            {(rows) =>
              rows.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Nobody yet" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="truncate font-medium">{r.member.name ?? "Unnamed"}</span>
                      <span className="tabular text-sm text-ink-soft">{fmtTime(r.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </AsyncBlock>
        </Panel>
      </div>
      <QrScannerDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onScan={onScan} />
    </>
  );
}
