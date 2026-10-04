"use client";

import { useStaff } from "@/components/admin/staff-session";
import { LinkButton, PageHeader, Panel } from "@/components/ui/primitives";
import { GymDetails } from "@/components/admin/settings/gym-details";
import { FeatureSwitches } from "@/components/admin/settings/feature-switches";
import { StaffAccounts } from "@/components/admin/settings/staff-accounts";
import { RolePermissions } from "@/components/admin/settings/role-permissions";
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
        <FeatureSwitches canEdit={allowed("settings:manage")} />
        {allowed("staff:manage") ? <StaffAccounts /> : null}
        {allowed("staff:read") ? <RolePermissions /> : null}
        <ChangePassword />
      </div>
    </>
  );
}
