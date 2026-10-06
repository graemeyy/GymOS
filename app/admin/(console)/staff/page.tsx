"use client";

import React, { useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { canGrantRole } from "@/lib/auth/permissions";
import { fmtDate } from "@/lib/format";
import { useStaff } from "@/components/admin/staff-session";
import { Button, LinkButton, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { DataList } from "@/components/ui/data-list";
import { useLocationFilter, type LocationOption } from "@/components/admin/location-filter";

interface RoleRow {
  id: string;
  name: string;
  isOwner: boolean;
  permissions: string[];
}
interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: { id: string; name: string; isOwner: boolean } | null;
  status: "active" | "invited" | "deactivated";
  inviteExpiresAt: string | null;
  // Empty means every location (D-128).
  locationIds: string[];
}
interface InviteResult {
  staff: StaffRow;
  emailed: boolean;
  inviteUrl: string | null;
}

const BLANK = { name: "", email: "", roleId: "", locationIds: [] as string[] };
const STATUS = { active: ["good", "Active"], invited: ["warn", "Invited"], deactivated: ["neutral", "Deactivated"] } as const;

export default function StaffPage() {
  const toast = useToast();
  const { me } = useStaff();
  const staff = useResource<StaffRow[]>("/api/staff");
  const roles = useResource<RoleRow[]>("/api/roles");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  // The link to pass on in person when the invitation couldn't be emailed.
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [deactivating, setDeactivating] = useState<StaffRow | null>(null);
  const filter = useLocationFilter();
  const [placing, setPlacing] = useState<{ row: StaffRow; locationIds: string[] } | null>(null);
  const locationName = new Map(filter.locations.map((l) => [l.id, l.name]));
  const placesText = (ids: string[]) => (ids.length === 0 ? "Every location" : ids.map((id) => locationName.get(id) ?? "Another location").join(", "));
  // Someone whose own role covers some locations can only give those.
  const mustChoose = Boolean(me && !me.isOwner && me.locationIds);

  const grantable = (roles.data ?? []).filter((r) => canGrantRole(me, r));
  const roleById = new Map((roles.data ?? []).map((r) => [r.id, r]));
  // Matches the server's safeguards: not yourself, and not anyone whose role
  // is more powerful than yours.
  const canChange = (row: StaffRow) => row.id !== me?.id && (!row.role || canGrantRole(me, roleById.get(row.role.id) ?? { isOwner: true, permissions: [] }));

  const afterInvite = (result: InviteResult) => {
    if (result.inviteUrl) setLink({ name: result.staff.name, url: result.inviteUrl });
    else toast(`Invitation emailed to ${result.staff.email}`);
    void staff.reload();
  };
  const invite = useMutation(() => api<InviteResult>("/api/staff/invite", { body: filter.multiple ? form : { name: form.name, email: form.email, roleId: form.roleId } }), {
    onSuccess: (result) => {
      setInviteOpen(false);
      setForm(BLANK);
      afterInvite(result);
    },
  });
  const resend = useMutation((row: StaffRow) => api<InviteResult>(`/api/staff/${row.id}/invite`, { method: "POST" }), {
    onSuccess: afterInvite,
    onError: (e) => toast(e.message, "bad"),
  });
  const update = useMutation((row: StaffRow, body: { roleId?: string; active?: boolean; locationIds?: string[] }) => api<StaffRow>(`/api/staff/${row.id}`, { method: "PUT", body }), {
    onSuccess: (updated, row, body) => {
      if (body.locationIds) {
        toast(`${row.name} now works at ${placesText(updated.locationIds).toLowerCase() === "every location" ? "every location" : placesText(updated.locationIds)}`);
        setPlacing(null);
      } else if (body.roleId) toast(`${row.name} is now ${updated.role?.name ?? "updated"}. They'll need to sign in again.`);
      else toast(body.active ? `${row.name} can sign in again` : `${row.name} is deactivated and signed out`);
      void staff.reload();
    },
    // Reload either way, so the select shows the role that was actually saved.
    onError: (e) => {
      toast(e.message, "bad");
      void staff.reload();
    },
  });

  return (
    <>
      <PageHeader
        title="Staff"
        description="Invite people, choose their role and deactivate accounts. What each role can do is on the Roles page."
        actions={
          <>
            <LinkButton href="/admin/roles" variant="secondary">
              Roles
            </LinkButton>
            <Button
              onClick={() => {
                invite.reset();
                setForm({ ...BLANK, roleId: grantable.find((r) => r.name === "Front desk")?.id ?? grantable[grantable.length - 1]?.id ?? "", locationIds: mustChoose && filter.current ? [filter.current] : [] });
                setInviteOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Invite staff
            </Button>
          </>
        }
      />
      <Panel>
        <AsyncBlock loading={staff.loading} error={staff.error} data={staff.data} onRetry={staff.reload}>
          {(rows) => (
            <DataList
              caption="Staff accounts"
              rows={rows}
              rowKey={(s) => s.id}
              columns={[
                {
                  header: "Name",
                  primary: true,
                  cell: (s) => (
                    <div className="min-w-0">
                      <p className="font-medium">
                        {s.name}
                        {s.id === me?.id ? <span className="text-ink-soft"> (you)</span> : null}
                      </p>
                      <p className="truncate text-sm text-ink-soft">{s.email}</p>
                    </div>
                  ),
                },
                {
                  header: "Role",
                  cell: (s) =>
                    canChange(s) ? (
                      <>
                        {/* aria-label, not an id: DataList renders each cell twice (table and phone list). */}
                        <select
                          aria-label={`Role for ${s.name}`}
                          value={s.role?.id ?? ""}
                          disabled={update.busy}
                          onChange={(e) => void update.run(s, { roleId: e.target.value })}
                          className="min-h-tap rounded border border-line-strong bg-surface px-3 text-sm disabled:bg-sunken"
                        >
                          {s.role ? null : <option value="">No role</option>}
                          {grantable.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <span>{s.role?.name ?? "No role"}</span>
                    ),
                },
                ...(filter.multiple
                  ? [
                      {
                        header: "Locations",
                        cell: (s: StaffRow) =>
                          canChange(s) && !s.role?.isOwner ? (
                            <button type="button" className="min-h-tap text-left text-sm font-medium text-plate underline-offset-2 hover:underline" onClick={() => setPlacing({ row: s, locationIds: s.locationIds })}>
                              {placesText(s.locationIds)}
                              <span className="sr-only">. Change where {s.name} works</span>
                            </button>
                          ) : (
                            <span className="text-sm">{s.role?.isOwner ? "Every location" : placesText(s.locationIds)}</span>
                          ),
                      },
                    ]
                  : []),
                {
                  header: "Status",
                  cell: (s) => (
                    <div>
                      <StatusTag tone={STATUS[s.status][0]}>{STATUS[s.status][1]}</StatusTag>
                      {s.status === "invited" && s.inviteExpiresAt ? <p className="mt-1 text-xs text-ink-soft">Link expires {fmtDate(s.inviteExpiresAt)}</p> : null}
                    </div>
                  ),
                },
              ]}
              actions={(s) =>
                canChange(s) ? (
                  <>
                    {s.status === "invited" ? (
                      <Button variant="ghost" busy={resend.busy} onClick={() => void resend.run(s)}>
                        <Mail className="h-4 w-4" aria-hidden="true" /> Resend invite
                      </Button>
                    ) : null}
                    {s.status === "deactivated" ? (
                      <Button variant="ghost" disabled={update.busy} onClick={() => void update.run(s, { active: true })}>
                        Reactivate
                      </Button>
                    ) : (
                      <Button variant="ghost" onClick={() => setDeactivating(s)}>
                        Deactivate
                      </Button>
                    )}
                  </>
                ) : null
              }
            />
          )}
        </AsyncBlock>
      </Panel>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite staff"
        description="They get an email with a link to set their own password. The link works once, for 7 days."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" busy={invite.busy}>
              Send invitation
            </Button>
          </>
        }
      >
        <form
          id="invite-form"
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            void invite.run();
          }}
          className="space-y-4"
          noValidate
        >
          <TextField label="Full name" required value={form.name} error={invite.fields.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
          <TextField label="Email" type="email" required value={form.email} error={invite.fields.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <SelectField label="Role" hint="You can only give roles whose permissions you have yourself." value={form.roleId} error={invite.fields.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            {grantable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
          {filter.multiple && !roleById.get(form.roleId)?.isOwner ? (
            <LocationChoice locations={filter.locations} value={form.locationIds} mustChoose={mustChoose} error={invite.fields.locationIds} onChange={(locationIds) => setForm({ ...form, locationIds })} />
          ) : null}
          {invite.error ? <FormMessage>{invite.error}</FormMessage> : null}
        </form>
      </Dialog>

      <Dialog
        open={Boolean(link)}
        onClose={() => setLink(null)}
        title="Pass on the invitation link"
        description={`Email isn't set up, so send ${link?.name ?? "them"} this link yourself. It works once, for 7 days.`}
        footer={
          <Button onClick={() => setLink(null)} data-autofocus>
            Done
          </Button>
        }
      >
        <TextField label="Invitation link" readOnly value={link?.url ?? ""} onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => {
            if (link) void navigator.clipboard?.writeText(link.url).then(() => toast("Link copied"));
          }}
        >
          Copy link
        </Button>
      </Dialog>

      <Dialog
        open={Boolean(placing)}
        onClose={() => setPlacing(null)}
        title={`Where ${placing?.row.name ?? "they"} works`}
        description="Their role's permissions apply at these locations only. They'll need to sign in again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlacing(null)}>
              Cancel
            </Button>
            <Button busy={update.busy} onClick={() => placing && void update.run(placing.row, { locationIds: placing.locationIds })}>
              Save locations
            </Button>
          </>
        }
      >
        {placing ? <LocationChoice locations={filter.locations} value={placing.locationIds} mustChoose={mustChoose} error={update.fields.locationIds} onChange={(locationIds) => setPlacing({ ...placing, locationIds })} /> : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deactivating)}
        onCancel={() => setDeactivating(null)}
        onConfirm={async () => {
          if (deactivating) await update.run(deactivating, { active: false });
          setDeactivating(null);
        }}
        busy={update.busy}
        title={`Deactivate ${deactivating?.name ?? "this account"}?`}
        confirmLabel="Deactivate account"
        body="They're signed out straight away and can't sign in until someone reactivates them. Their past actions stay in the audit log."
      />
    </>
  );
}

// Every location (an empty list), or some of them (D-128).
function LocationChoice({ locations, value, mustChoose, error, onChange }: { locations: LocationOption[]; value: string[]; mustChoose: boolean; error?: string; onChange: (ids: string[]) => void }) {
  const every = value.length === 0 && !mustChoose;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Works at</legend>
      {mustChoose ? null : (
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-plate" checked={every} onChange={(e) => onChange(e.target.checked ? [] : [locations[0]?.id].filter(Boolean) as string[])} />
          Every location, including new ones
        </label>
      )}
      {every
        ? null
        : locations.map((l) => (
            <label key={l.id} className="ml-8 flex items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-plate" checked={value.includes(l.id)} disabled={value.length === 1 && value[0] === l.id} onChange={(e) => onChange(e.target.checked ? [...value, l.id] : value.filter((id) => id !== l.id))} />
              {l.name}
            </label>
          ))}
      {error ? <p className="text-sm font-medium text-bad">{error}</p> : null}
    </fieldset>
  );
}
