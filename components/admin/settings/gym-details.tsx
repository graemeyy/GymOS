"use client";

import React from "react";
import Link from "next/link";
import { gym } from "@/lib/config/client";
import { useBranding } from "@/components/branding/branding-provider";
import { formatBrandAddress } from "@/lib/branding/types";
import { formatAud } from "@/lib/money";
import { Panel, PanelHeader } from "@/components/ui/primitives";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function GymDetails({ canEditBranding = false }: { canEditBranding?: boolean }) {
  const p = gym.policies;
  const brand = useBranding();
  return (
    <Panel aria-labelledby="gym-heading">
      <PanelHeader id="gym-heading" title="Gym details and policies" />
      <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">
        The business name, ABN, address and contact details are set on the{" "}
        {canEditBranding ? (
          <Link href="/admin/branding" className="font-medium text-plate underline underline-offset-2">
            Branding page
          </Link>
        ) : (
          "Branding page (Owner only)"
        )}
        . Policies come from <code className="rounded bg-sunken px-1">config/gym.config.json</code>; edit that file and redeploy to change them.
        {gym.isDemo ? " The shipped values are fictional demo details." : ""}
      </p>
      <dl className="divide-y divide-line">
        <Row label="Business">
          {brand.legalName}, ABN {brand.abn}
          {gym.business.gstRegistered ? ", registered for GST" : ", not registered for GST"}
        </Row>
        <Row label="Address">{formatBrandAddress(brand.address)}</Row>
        <Row label="Contact">
          {brand.contactPhone}, {brand.contactEmail}
        </Row>
        <Row label="Timezone">{gym.business.timezone}</Row>
        <Row label="Cancellation">
          {p.cancellation.noticeDays} days&apos; notice
          {p.cancellation.minimumTermWeeks ? `, ${p.cancellation.minimumTermWeeks}-week minimum term` : ", no minimum term"}
          {p.cancellation.coolingOffDays ? `, ${p.cancellation.coolingOffDays}-day cooling-off period` : ""}
        </Row>
        <Row label="Pausing">
          {p.pause.allowMemberSelfPause ? "Members can pause themselves" : "Staff pause memberships"}, {p.pause.minDays} to {p.pause.maxDays} days, up to {p.pause.maxPausesPerYear} times a year
          {p.pause.feeCents ? `, ${formatAud(p.pause.feeCents)} fee (not charged automatically yet: collect it at the desk)` : ", no fee"}
        </Row>
        <Row label="Failed payments">
          Reminders on days {p.failedPayments.reminderDays.join(", ")}, access suspended after {p.failedPayments.suspendAccessAfterDays} days
        </Row>
      </dl>
    </Panel>
  );
}
