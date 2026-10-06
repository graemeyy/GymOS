"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { AU_STATES } from "@/lib/config/constants";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";
import { useStaff } from "@/components/admin/staff-session";
import { useLocationFilter } from "@/components/admin/location-filter";
import { Button, PageHeader, Panel, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";

interface Location {
  id: string;
  name: string;
  code: string;
  addressLine1: string;
  addressLine2: string;
  suburb: string;
  state: string;
  postcode: string;
  phone: string | null;
  sortOrder: number;
  archivedAt: string | null;
}

const blank = { name: "", code: "", addressLine1: "", addressLine2: "", suburb: "", state: "", postcode: "", phone: "", sortOrder: "0" };
type Form = typeof blank;

const address = (l: Location) => [l.addressLine1, l.addressLine2, [l.suburb, l.state, l.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");

// Sites of a gym or chain (D-125). Classes, shifts, check-ins, shop stock,
// announcements and reports each belong to one.
export default function LocationsPage() {
  const toast = useToast();
  const { can } = useStaff();
  const filter = useLocationFilter();
  const list = useResource<Location[]>("/api/locations?archived=include");
  const [editing, setEditing] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [archiving, setArchiving] = useState<Location | null>(null);
  const canEdit = can("settings.edit");

  const refresh = async () => {
    await Promise.all([list.reload(), filter.reload()]);
  };

  const save = useMutation((target: Location | null, body: Record<string, unknown>) => api<Location>(target ? `/api/locations/${target.id}` : "/api/locations", { method: target ? "PUT" : "POST", body }), {
    onSuccess: async (saved, target) => {
      toast(target ? `${saved.name} saved` : `${saved.name} added`);
      setOpen(false);
      await refresh();
    },
  });

  const archive = useMutation((l: Location, archived: boolean) => api<Location>(`/api/locations/${l.id}`, { method: "PATCH", body: { archived } }), {
    onSuccess: async (saved, _l, archived) => {
      toast(archived ? `${saved.name} archived` : `${saved.name} restored`);
      setArchiving(null);
      await refresh();
    },
    onError: (e) => {
      toast(e.message, "bad");
      setArchiving(null);
    },
  });

  const openForm = (l: Location | null) => {
    setEditing(l);
    save.reset();
    setForm(l ? { name: l.name, code: l.code, addressLine1: l.addressLine1, addressLine2: l.addressLine2, suburb: l.suburb, state: l.state, postcode: l.postcode, phone: l.phone ?? "", sortOrder: String(l.sortOrder) } : blank);
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void save.run(editing, { ...form, phone: form.phone.trim() || null, sortOrder: Number(form.sortOrder) || 0 });
  };

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <PageHeader
        title="Locations"
        description="Each site where members train. Plans say which locations members can use, and staff roles can be limited to some of them."
        actions={
          canEdit ? (
            <Button onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add location
            </Button>
          ) : null
        }
      />
      <AsyncBlock loading={list.loading} error={list.error} data={list.data} onRetry={list.reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No locations" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rows.map((l) => (
                <Panel key={l.id} as="article" aria-labelledby={`loc-${l.id}`} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 id={`loc-${l.id}`} className="text-xl">
                        {l.name}
                      </h2>
                      <p className="text-sm text-ink-soft">
                        Code <span className="font-medium text-ink">{l.code}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {l.id === MAIN_LOCATION_ID ? <StatusTag tone="plate">Main</StatusTag> : null}
                      {l.archivedAt ? <StatusTag tone="warn">Archived</StatusTag> : null}
                    </div>
                  </div>
                  <p className="text-sm">{address(l) || <span className="text-ink-soft">No address yet</span>}</p>
                  {l.phone ? <p className="text-sm">{l.phone}</p> : null}
                  {canEdit ? (
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => openForm(l)}>
                        Edit
                      </Button>
                      {l.id === MAIN_LOCATION_ID ? null : l.archivedAt ? (
                        <Button variant="ghost" onClick={() => void archive.run(l, false)} busy={archive.busy}>
                          Restore
                        </Button>
                      ) : (
                        <Button variant="ghost" onClick={() => setArchiving(l)}>
                          Archive
                        </Button>
                      )}
                    </div>
                  ) : null}
                </Panel>
              ))}
            </div>
          )
        }
      </AsyncBlock>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add a location"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="location-form" busy={save.busy}>
              {editing ? "Save location" : "Add location"}
            </Button>
          </>
        }
      >
        <form id="location-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" value={form.name} error={save.fields.name} onChange={set("name")} data-autofocus />
            <TextField
              label="Code"
              hint="Door scanners and kiosks send this. Lowercase letters, numbers and hyphens."
              value={form.code}
              error={save.fields.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
            />
          </div>
          <TextField label="Street address" value={form.addressLine1} error={save.fields.addressLine1} onChange={set("addressLine1")} autoComplete="address-line1" />
          <TextField label="Address line 2 (optional)" value={form.addressLine2} error={save.fields.addressLine2} onChange={set("addressLine2")} autoComplete="address-line2" />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Suburb" value={form.suburb} error={save.fields.suburb} onChange={set("suburb")} autoComplete="address-level2" />
            <SelectField label="State" value={form.state} error={save.fields.state} onChange={set("state")}>
              <option value="">Choose</option>
              {AU_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <TextField label="Postcode" inputMode="numeric" value={form.postcode} error={save.fields.postcode} onChange={set("postcode")} autoComplete="postal-code" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Phone (optional)" type="tel" value={form.phone} error={save.fields.phone} onChange={set("phone")} />
            <TextField label="Order in lists" hint="Lower numbers come first." type="number" min={0} max={999} value={form.sortOrder} error={save.fields.sortOrder} onChange={set("sortOrder")} />
          </div>
          {save.error ? <FormMessage>{save.error}</FormMessage> : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(archiving)}
        onCancel={() => setArchiving(null)}
        onConfirm={() => archiving && void archive.run(archiving, true)}
        busy={archive.busy}
        title={`Archive ${archiving?.name ?? ""}?`}
        confirmLabel="Archive"
        body="It disappears from timetables, pickers and the member app. Its history stays in reports. Move members and upcoming classes elsewhere first."
      />
    </>
  );
}
