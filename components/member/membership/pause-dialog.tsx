"use client";

import { useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { gym } from "@/lib/config/client";
import { addCalendarDays, localDateIn } from "@/lib/dates";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, TextField } from "@/components/ui/form";
import type { Options } from "./types";

// The gym's local date, not UTC (which is yesterday before 10 or 11am in
// Sydney) (R-13).
const today = () => localDateIn(gym.business.timezone);

export function PauseDialog({ options, onClose, onDone }: { options: Options["pause"]; onClose: () => void; onDone: () => Promise<void> }) {
  const [from, setFrom] = useState(today());
  const [until, setUntil] = useState(addCalendarDays(today(), Math.max(options.minDays, 14)));
  const toast = useToast();
  const pause = useMutation(() => api("/api/me/membership/pause", { body: { from, until } }), {
    onSuccess: async () => {
      toast(`Paused from ${fmtDate(from)} to ${fmtDate(until)}.`);
      onClose();
      await onDone();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Pause my membership"
      description={`Between ${options.minDays} and ${options.maxDays} days. You won't be charged while paused.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={() => void pause.run()} busy={pause.busy}>
            Pause
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="From" type="date" min={today()} value={from} onChange={(e) => setFrom(e.target.value)} error={pause.fields.from} />
        <TextField label="Until" type="date" min={addCalendarDays(from, options.minDays)} max={addCalendarDays(from, options.maxDays)} value={until} onChange={(e) => setUntil(e.target.value)} error={pause.fields.until} />
      </div>
      {pause.error && !Object.keys(pause.fields).length ? <div className="mt-3"><FormMessage>{pause.error}</FormMessage></div> : null}
    </Dialog>
  );
}
