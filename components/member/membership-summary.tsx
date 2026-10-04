import { formatAud, INTERVAL_LABELS } from "@/lib/money";
import { STATUS_TEXT, STATUS_TONE } from "@/lib/client/labels";
import { fmtDate } from "@/lib/format";
import { StatusTag } from "@/components/ui/primitives";
import type { Me } from "./types";

// One plain sentence per thing the member needs to know about their
// membership right now, most urgent first.
export function membershipNotices(me: Me): { tone: "bad" | "warn" | "neutral"; text: string }[] {
  const notices: { tone: "bad" | "warn" | "neutral"; text: string }[] = [];
  if (me.status === "PAST_DUE") {
    notices.push({ tone: "bad", text: `Your last payment didn't go through${me.amountOwingCents ? ` (${formatAud(me.amountOwingCents)} owing)` : ""}. Update your card so you can keep training.` });
  }
  if (me.pausedUntil && new Date(me.pausedUntil) > new Date()) {
    const from = me.pausedFrom ? new Date(me.pausedFrom) : null;
    notices.push({ tone: "neutral", text: from && from > new Date() ? `Paused from ${fmtDate(from)} to ${fmtDate(me.pausedUntil)}.` : `Paused until ${fmtDate(me.pausedUntil)}. You won't be charged while paused.` });
  }
  if (me.cancelAt) notices.push({ tone: "warn", text: `Your membership ends on ${fmtDate(me.cancelAt)}.` });
  if (me.pendingPlan) notices.push({ tone: "neutral", text: `Changing to ${me.pendingPlan.name} on your next billing date.` });
  if (me.status === "CANCELED") notices.push({ tone: "neutral", text: `Your membership ended${me.cancelledAt ? ` on ${fmtDate(me.cancelledAt)}` : ""}. You can start a new one any time.` });
  return notices;
}

export function MembershipLine({ me }: { me: Me }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusTag tone={STATUS_TONE[me.status]}>{STATUS_TEXT[me.status]}</StatusTag>
      {me.membershipPlan ? (
        <span className="text-ink-soft">
          {me.membershipPlan.name}, {formatAud(me.membershipPlan.priceCents)} per {INTERVAL_LABELS[me.membershipPlan.interval].noun}
        </span>
      ) : (
        <span className="text-ink-soft">No plan yet</span>
      )}
    </div>
  );
}
