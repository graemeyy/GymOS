"use client";

import { api, useMutation, useResource } from "@/lib/client/api";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";

interface FeatureSettings {
  requireKeycardForEntry: boolean;
  hideRevenueFromFrontDesk: boolean;
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
          <div className="divide-y divide-line px-4">
            <Switch label="Require a keycard to enter" description="Members without an issued keycard are refused at the door." checked={s.requireKeycardForEntry} disabled={!canEdit || save.busy} onChange={(v) => void save.run({ requireKeycardForEntry: v })} />
            <Switch label="Hide revenue from front desk" description="Front-desk staff won't see revenue figures or payment history." checked={s.hideRevenueFromFrontDesk} disabled={!canEdit || save.busy} onChange={(v) => void save.run({ hideRevenueFromFrontDesk: v })} />
          </div>
        )}
      </AsyncBlock>
    </Panel>
  );
}
