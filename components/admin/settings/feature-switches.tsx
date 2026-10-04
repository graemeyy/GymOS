"use client";

import { api, useMutation, useResource } from "@/lib/client/api";
import { AdminOnlyNote, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";

// hideRevenueFromFrontDesk is still stored but has no effect: who sees money
// is the finance.view permission now (D-101).
interface FeatureSettings {
  requireKeycardForEntry: boolean;
}

export function FeatureSwitches({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const settings = useResource<FeatureSettings>("/api/settings/features");
  // Sends only the changed field and locks the switches until it's saved, so
  // quick toggles can't overwrite each other (R-51).
  const save = useMutation((change: Partial<FeatureSettings>) => api("/api/settings/features", { method: "PUT", body: change }), {
    onSuccess: async () => {
      toast("Setting saved");
      await settings.reload();
    },
    onError: (e) => toast(e.message, "bad"),
  });
  return (
    <Panel aria-labelledby="features-heading">
      <PanelHeader id="features-heading" title="Front desk" />
      <AsyncBlock loading={settings.loading} error={settings.error} data={settings.data} onRetry={settings.reload}>
        {(s) => (
          <div className="px-4">
            <Switch label="Require a keycard to enter" description="Members without an issued keycard are refused at the door." checked={s.requireKeycardForEntry} disabled={!canEdit || save.busy} onChange={(v) => void save.run({ requireKeycardForEntry: v })} />
            {canEdit ? null : <AdminOnlyNote className="pb-3" />}
          </div>
        )}
      </AsyncBlock>
    </Panel>
  );
}
