"use client";

import { useResource } from "@/lib/client/api";
import { STATUS_TEXT, STATUS_TONE } from "@/lib/client/labels";
import { PageHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock } from "@/components/ui/feedback";
import type { Me } from "@/components/member/types";

interface Pass {
  token: string;
  status: Me["status"];
  name: string | null;
  svgDataUrl: string;
}

// The pass is always black on white, the same in dark mode, so the front
// desk scanner reads it first time.
export default function PassPage() {
  const pass = useResource<Pass>("/api/me/pass");
  return (
    <div>
      <PageHeader title="My pass" description="Show this at the front desk. Turn your screen brightness up if it doesn't scan." />
      <AsyncBlock loading={pass.loading} error={pass.error} data={pass.data} onRetry={pass.reload} loadingLabel="Loading your pass">
        {(p) => (
          <div className="mx-auto max-w-sm">
            <div className="rounded-lg border border-line bg-white p-5 text-[#15191C]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.svgDataUrl} alt={`Check-in QR code for ${p.name ?? "your membership"}`} width={320} height={320} className="mx-auto aspect-square w-full max-w-[320px]" />
              <p className="mt-3 text-center font-display text-2xl font-bold">{p.name}</p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <StatusTag tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</StatusTag>
              {p.status !== "ACTIVE" ? <span className="text-sm text-ink-soft">The front desk will check your membership when you scan.</span> : null}
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Lost your phone or shared a screenshot? Ask the front desk to reissue your pass. Old passes stop working straight away.
            </p>
            <details className="mt-4 text-sm text-ink-soft">
              <summary className="cursor-pointer">Scanner not working?</summary>
              <p className="mt-2">Staff can type this code instead:</p>
              <p className="mt-1 break-all rounded bg-sunken p-2 font-mono text-xs text-ink">{p.token}</p>
            </details>
          </div>
        )}
      </AsyncBlock>
    </div>
  );
}
