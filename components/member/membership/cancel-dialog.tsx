"use client";

import { useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, TextareaField } from "@/components/ui/form";
import type { Options } from "./types";

const CANCEL_RULE: Record<string, string> = {
  cooling_off: "You're within the cooling-off period, so it ends today and you won't be charged again.",
  notice: "This includes the gym's notice period.",
  minimum_term: "This is the end of your minimum term.",
  immediate: "It ends today.",
};

export function CancelDialog({ options, onClose, onDone }: { options: Options["cancellation"]; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const toast = useToast();
  const preview = options.preview;
  const cancel = useMutation(() => api<{ effectiveAt: string; reason: string }>("/api/me/membership/cancel", { body: { reason: reason.trim() || undefined } }), {
    onSuccess: async (res) => {
      toast(res.reason === "cooling_off" ? "Your membership is cancelled." : `Your membership ends on ${fmtDate(res.effectiveAt)}.`);
      onClose();
      await onDone();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Cancel my membership"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep my membership
          </Button>
          <Button variant="danger" onClick={() => void cancel.run()} busy={cancel.busy}>
            Cancel membership
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {preview ? (
          <p>
            {preview.reason === "cooling_off" ? "" : `Your last day will be ${fmtDate(preview.effectiveAt)}. `}
            {CANCEL_RULE[preview.reason]}
            {preview.reason === "cooling_off" ? "" : " You can keep training until then."}
          </p>
        ) : null}
        <TextareaField label="Anything we could do better? (optional)" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        {cancel.error ? <FormMessage>{cancel.error}</FormMessage> : null}
      </div>
    </Dialog>
  );
}
