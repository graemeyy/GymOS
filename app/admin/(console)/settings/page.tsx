"use client";

import { useStaff } from "@/components/admin/staff-session";
import { LinkButton, PageHeader, Panel } from "@/components/ui/primitives";
import { GymDetails } from "@/components/admin/settings/gym-details";
import { FeatureSwitches } from "@/components/admin/settings/feature-switches";
import { ChangePassword } from "@/components/admin/settings/change-password";

export default function SettingsPage() {
  const { can: allowed, loading } = useStaff();
  if (loading) return <PageHeader title="Settings" />;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <GymDetails />
        <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg">Plans and prices</h2>
            <p className="text-sm text-ink-soft">Tiers, prices and benefits are managed on the Plans page.</p>
          </div>
          <LinkButton href="/admin/plans" variant="secondary">
            Open plans
          </LinkButton>
        </Panel>
        <FeatureSwitches canEdit={allowed("settings.edit")} />
        <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg">Staff and roles</h2>
            <p className="text-sm text-ink-soft">Invite staff, choose what each role can do, and see who changed what.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowed("staff.manage") ? (
              <LinkButton href="/admin/staff" variant="secondary">
                Staff
              </LinkButton>
            ) : null}
            <LinkButton href="/admin/roles" variant="secondary">
              Roles
            </LinkButton>
            {allowed("audit.view") ? (
              <LinkButton href="/admin/audit" variant="secondary">
                Audit log
              </LinkButton>
            ) : null}
          </div>
        </Panel>
        <ChangePassword />
      </div>
    </>
  );
}
