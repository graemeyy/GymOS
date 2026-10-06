"use client";

import { useEffect, useState } from "react";
import { useResource } from "@/lib/client/api";
import { STATUS_TEXT, STATUS_TONE } from "@/lib/members/labels";
import { PageHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock } from "@/components/ui/feedback";
import type { Me } from "@/components/member/types";

interface Pass {
  token: string;
  expiresAt: string;
  refreshSeconds: number;
  status: Me["status"];
  name: string | null;
  svgDataUrl: string;
}

// The pass is always black on white, the same in dark mode, so the front
// desk scanner reads it first time. The code changes every minute and each
// one works for 90 seconds, once (D-119), so a screenshot is no use.
export default function PassPage() {
  const pass = useResource<Pass>("/api/me/pass");
  const { reload } = pass;
  const refreshSeconds = pass.data?.refreshSeconds ?? 60;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = setInterval(() => void reload(), refreshSeconds * 1000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Coming back to the app after a while: show a fresh code straight away.
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, refreshSeconds]);

  const expired = pass.data ? new Date(pass.data.expiresAt).getTime() <= now : false;

  return (
    <div>
      <PageHeader title="My pass" description="Show this at the front desk. Turn your screen brightness up if it doesn't scan." />
      <AsyncBlock loading={pass.loading && !pass.data} error={pass.data ? null : pass.error} data={pass.data} onRetry={reload} loadingLabel="Loading your pass">
        {(p) => (
          <div className="mx-auto max-w-sm">
            <div className="rounded-lg border border-line bg-white p-5 text-[#15191C]">
              {expired ? (
                <div role="alert" className="flex aspect-square w-full flex-col items-center justify-center gap-3 text-center">
                  <p className="font-display text-xl font-bold">Your code needs refreshing</p>
                  <p className="text-sm">Check your connection. If you can&apos;t get online, the front desk can find you by name.</p>
                  <button type="button" onClick={() => void reload()} className="rounded border border-[#15191C] px-4 py-2 font-medium">
                    Try again
                  </button>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.svgDataUrl} alt={`Check-in QR code for ${p.name ?? "your membership"}`} width={320} height={320} className="mx-auto aspect-square w-full max-w-[320px]" />
              )}
              <p className="mt-3 text-center font-display text-2xl font-bold">{p.name}</p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <StatusTag tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</StatusTag>
              {p.status !== "ACTIVE" ? <span className="text-sm text-ink-soft">The front desk will check your membership when you scan.</span> : null}
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              The code changes every minute and each one works once, so a screenshot won&apos;t get anyone in. Lost your phone? Ask the front desk to reissue your pass.
            </p>
            <p className="mt-3 text-sm text-ink-soft">Scanner not working? The front desk can find you by name.</p>
          </div>
        )}
      </AsyncBlock>
    </div>
  );
}
