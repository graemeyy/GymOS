import React from "react";
import { gym, formatAddress } from "@/lib/config/client";
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

export function GymDetails() {
  const p = gym.policies;
  return (
    <Panel aria-labelledby="gym-heading">
      <PanelHeader id="gym-heading" title="Gym details and policies" />
      <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">
        These come from <code className="rounded bg-sunken px-1">config/gym.config.json</code>, so a new gym can be set up without code changes. Edit that file and redeploy to change them.
        {gym.isDemo ? " The current values are fictional demo details." : ""}
      </p>
      <dl className="divide-y divide-line">
        <Row label="Business">
          {gym.business.legalName}, ABN {gym.business.abn}
          {gym.business.gstRegistered ? ", registered for GST" : ", not registered for GST"}
        </Row>
        <Row label="Address">{formatAddress()}</Row>
        <Row label="Contact">
          {gym.business.phone}, {gym.business.email}
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
