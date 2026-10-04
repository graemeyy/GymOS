"use client";

import React, { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { canGrantRole, OWNER_ONLY_ACTIONS, PERMISSION_GROUPS, PERMISSION_INFO, type Permission } from "@/lib/auth/permissions";
import { useStaff } from "@/components/admin/staff-session";
import { AdminOnlyNote, Button, IconButton, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { cn } from "@/lib/client/cn";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  preset: string | null;
  isOwner: boolean;
  permissions: Permission[];
  staffCount: number;
}

const BLANK = { name: "", description: "", copyFrom: "" };

export default function RolesPage() {
  const toast = useToast();
  const { me, can } = useStaff();
  const roles = useResource<RoleRow[]>("/api/roles");
  const manage = can("roles.manage");
  const [mobileRoleId, setMobileRoleId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoleRow | "new" | null>(null);
  const [form, setForm] = useState(BLANK);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);

  // Owner role never changes; others only within the viewer's own permissions.
  const editableRole = (r: RoleRow) => manage && !r.isOwner && canGrantRole(me, r);
  const canToggle = (r: RoleRow, p: Permission) => editableRole(r) && (me?.isOwner || me?.permissions.includes(p) === true);

  const toggle = useMutation(
    (role: RoleRow, permission: Permission, on: boolean) =>
      api(`/api/roles/${role.id}`, { method: "PUT", body: { permissions: on ? [...role.permissions, permission] : role.permissions.filter((p) => p !== permission) } }),
    {
      onSuccess: async (_, role, permission, on) => {
        toast(`${role.name} ${on ? "can now" : "can no longer"}: ${PERMISSION_INFO[permission].label.toLowerCase()}`);
        await roles.reload();
      },
      onError: (e) => {
        toast(e.message, "bad");
        void roles.reload();
      },
    }
  );
  const save = useMutation(
    () => {
      if (editing === "new") {
        const source = roles.data?.find((r) => r.id === form.copyFrom);
        const permissions = (source?.permissions ?? []).filter((p) => me?.isOwner || me?.permissions.includes(p));
        return api("/api/roles", { body: { name: form.name, description: form.description || null, permissions } });
      }
      return api(`/api/roles/${(editing as RoleRow).id}`, { method: "PUT", body: { name: form.name, description: form.description || null } });
    },
    {
      onSuccess: async () => {
        toast(editing === "new" ? "Role created" : "Role saved");
        setEditing(null);
        await roles.reload();
      },
    }
  );
  const remove = useMutation((role: RoleRow) => api(`/api/roles/${role.id}`, { method: "DELETE" }), {
    onSuccess: async () => {
      toast("Role deleted");
      await roles.reload();
    },
    onError: (e) => toast(e.message, "bad"),
  });

  const openEditor = (role: RoleRow | "new") => {
    save.reset();
    setForm(role === "new" ? BLANK : { name: role.name, description: role.description ?? "", copyFrom: "" });
    setEditing(role);
  };

  return (
    <>
      <PageHeader
        title="Roles"
        description="What each role can do. Changes apply the next time each person loads a page."
        actions={
          manage ? (
            <Button onClick={() => openEditor("new")}>
              <Plus className="h-4 w-4" aria-hidden="true" /> New role
            </Button>
          ) : null
        }
      />
      {manage ? null : <AdminOnlyNote className="mb-4" />}
      <AsyncBlock loading={roles.loading} error={roles.error} data={roles.data} onRetry={roles.reload}>
        {(list) => {
          const mobileRole = list.find((r) => r.id === mobileRoleId) ?? list[0];
          const cell = (r: RoleRow, p: Permission, withLabel: boolean) => {
            const on = r.permissions.includes(p);
            const label = `${r.name}: ${PERMISSION_INFO[p].label}`;
            return (
              <label className={cn("inline-flex min-h-tap items-center gap-3", withLabel ? "w-full justify-between" : "justify-center")}>
                {withLabel ? <span className="text-sm">{PERMISSION_INFO[p].label}</span> : null}
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={on}
                  disabled={!canToggle(r, p) || toggle.busy}
                  onChange={(e) => void toggle.run(r, p, e.target.checked)}
                  className="h-5 w-5 accent-plate disabled:opacity-60"
                />
              </label>
            );
          };
          return (
            <div className="space-y-6">
              {/* Phones: one role at a time, so nothing scrolls sideways. */}
              <Panel className="md:hidden">
                <div className="border-b border-line p-4">
                  <SelectField label="Role" value={mobileRole?.id ?? ""} onChange={(e) => setMobileRoleId(e.target.value)}>
                    {list.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </SelectField>
                  {mobileRole?.description ? <p className="mt-2 text-sm text-ink-soft">{mobileRole.description}</p> : null}
                  {mobileRole && editableRole(mobileRole) ? (
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" onClick={() => openEditor(mobileRole)}>
                        Rename
                      </Button>
                      {mobileRole.preset ? null : (
                        <Button variant="danger" onClick={() => setDeleting(mobileRole)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
                {mobileRole
                  ? PERMISSION_GROUPS.map((g) => (
                      <div key={g.group} className="border-b border-line px-4 py-2 last:border-b-0">
                        <h2 className="py-2 text-sm font-medium text-ink-soft">{g.group}</h2>
                        {g.permissions.map((p) => (
                          <div key={p}>{cell(mobileRole, p, true)}</div>
                        ))}
                      </div>
                    ))
                  : null}
              </Panel>

              <Panel className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Permissions for each role</caption>
                  <thead>
                    <tr className="border-b border-line align-bottom">
                      <th scope="col" className="px-4 py-3 text-left font-medium text-ink-soft">
                        Permission
                      </th>
                      {list.map((r) => (
                        <th key={r.id} scope="col" className="px-2 py-3 text-center font-medium">
                          <span className="block">{r.name}</span>
                          <span className="block text-xs font-normal text-ink-soft">{r.staffCount === 1 ? "1 person" : `${r.staffCount} people`}</span>
                          {editableRole(r) ? (
                            <span className="mt-1 flex justify-center">
                              <IconButton label={`Rename ${r.name}`} onClick={() => openEditor(r)}>
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </IconButton>
                              {r.preset ? null : (
                                <IconButton label={`Delete ${r.name}`} onClick={() => setDeleting(r)}>
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </IconButton>
                              )}
                            </span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {PERMISSION_GROUPS.map((g) => (
                    <tbody key={g.group} className="divide-y divide-line border-b border-line">
                      <tr>
                        <th scope="colgroup" colSpan={list.length + 1} className="bg-sunken px-4 py-2 text-left text-xs font-medium text-ink-soft">
                          {g.group}
                        </th>
                      </tr>
                      {g.permissions.map((p) => (
                        <tr key={p}>
                          <th scope="row" className="px-4 py-2 text-left font-normal">
                            <span className="block font-medium">{PERMISSION_INFO[p].label}</span>
                            <span className="block max-w-md text-xs text-ink-soft">{PERMISSION_INFO[p].detail}</span>
                          </th>
                          {list.map((r) => (
                            <td key={r.id} className="px-2 py-1 text-center">
                              {cell(r, p, false)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </Panel>

              <Panel aria-labelledby="owner-only-heading">
                <PanelHeader id="owner-only-heading" title="Only owners can" />
                <ul className="list-disc space-y-1 py-3 pl-9 pr-4 text-sm">
                  {OWNER_ONLY_ACTIONS.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">
                  Trainers always see their own classes and mark attendance for them, with only the member details those classes need. Nobody can give a permission they don&apos;t have, and there&apos;s always at least one owner.
                </p>
              </Panel>
            </div>
          );
        }}
      </AsyncBlock>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New role" : `Rename ${editing?.name ?? "role"}`}
        description={editing === "new" ? "Start empty or copy a role, then choose permissions in the table." : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="role-form" busy={save.busy}>
              {editing === "new" ? "Create role" : "Save role"}
            </Button>
          </>
        }
      >
        <form
          id="role-form"
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            void save.run();
          }}
          className="space-y-4"
          noValidate
        >
          <TextField label="Name" required value={form.name} error={save.fields.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          <TextField label="Description" hint="Optional. What this role is for." value={form.description} error={save.fields.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {editing === "new" ? (
            <SelectField label="Start with the permissions of" hint="Only permissions you have yourself are copied." value={form.copyFrom} onChange={(e) => setForm({ ...form, copyFrom: e.target.value })}>
              <option value="">Nothing (start empty)</option>
              {(roles.data ?? [])
                .filter((r) => !r.isOwner)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </SelectField>
          ) : null}
          {save.error ? <FormMessage>{save.error}</FormMessage> : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove.run(deleting);
          setDeleting(null);
        }}
        busy={remove.busy}
        title={`Delete the ${deleting?.name ?? ""} role?`}
        confirmLabel="Delete role"
        body={deleting && deleting.staffCount > 0 ? "Move everyone off this role first. The server will refuse while anyone has it." : "Nobody has this role. Deleting it can't be undone, but the audit log keeps what it allowed."}
      />
    </>
  );
}
