import { can, ROLE_LABELS, STAFF_ROLES, type Permission } from "@/lib/auth/permissions";
import { PERMISSION_TEXT } from "@/lib/auth/permission-text";
import { Panel, PanelHeader } from "@/components/ui/primitives";

export function RolePermissions() {
  const groups: [string, Permission[]][] = [
    ["Members", ["members:read", "members:write", "members:archive"]],
    ["Money", ["revenue:view", "billing:manage", "billing:refund", "finance:view"]],
    ["Classes and check-in", ["classes:read", "classes:book", "classes:attendance", "classes:manage", "checkin:scan"]],
    ["Shop", ["orders:fulfil", "shop:manage", "inventory:adjust"]],
    ["Running the gym", ["plans:manage", "announcements:manage", "staff:manage", "audit:read", "settings:manage"]],
  ];
  return (
    <Panel aria-labelledby="roles-heading">
      <PanelHeader id="roles-heading" title="What each role can do" />
      {/* Focusable so keyboard users can scroll it sideways on a phone. */}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Permissions by role, scrollable">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th scope="col" className="px-4 py-2 font-medium">Permission</th>
              {STAFF_ROLES.map((r) => (
                <th key={r} scope="col" className="px-3 py-2 text-center font-medium">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(([group, perms]) => (
            <tbody key={group} className="border-b border-line last:border-0">
              <tr>
                <th scope="rowgroup" colSpan={5} className="bg-floor px-4 py-1.5 text-left text-xs font-medium text-ink-soft">
                  {group}
                </th>
              </tr>
              {perms.map((p) => (
                <tr key={p}>
                  <th scope="row" className="px-4 py-1.5 text-left font-normal">
                    {PERMISSION_TEXT[p]}
                  </th>
                  {STAFF_ROLES.map((r) => (
                    <td key={r} className="px-3 py-1.5 text-center">
                      {can(r, p) ? <span aria-label="Yes" className="font-medium text-good">Yes</span> : <span aria-label="No" className="text-ink-soft">No</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">Front desk can also be stopped from seeing revenue with the switch above. Trainers can only mark attendance for their own classes.</p>
    </Panel>
  );
}
