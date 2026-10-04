"use client";

import { useState } from "react";
import { Trash2, Users } from "lucide-react";
import { api, useMutation } from "@/lib/client/api";
import { fmtTime } from "@/lib/format";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/form";
import type { ClassRow, Person } from "./types";

export function ClassCard({ cls, members, onChange }: { cls: ClassRow; members: Person[]; onChange: () => void }) {
  const { can, me } = useStaff();
  // Anyone with bookings.manage, or the class's own trainer (lib/auth/access.ts).
  const canMarkAttendance = can("bookings.manage") || (Boolean(me) && cls.trainer?.id === me?.id);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [casual, setCasual] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const full = cls.bookings.length >= cls.capacity;
  const taken = new Set([...cls.bookings.map((b) => b.memberId), ...cls.waitlist.map((w) => w.memberId)]);

  // One change at a time per class: while one is being sent the class's
  // buttons are disabled, so a double tap can't send it twice (R-57).
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const action = useMutation((fn: () => Promise<unknown>, _success: string) => fn(), {
    onSuccess: (_, _fn, success) => {
      toast(success);
      onChange();
    },
    onError: (e) => toast(e.message, "bad"),
  });
  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    if (action.busy) return;
    setPendingKey(key);
    await action.run(fn, success);
    setPendingKey(null);
  };
  const busy = (key: string) => ({ busy: action.busy && pendingKey === key, disabled: action.busy && pendingKey !== key });
  const pending = action.busy ? pendingKey : null;

  const addMember = () =>
    memberId &&
    run(
      "add",
      () => api(`/api/classes/${cls.id}/${full ? "waitlist" : "book"}`, { body: full ? { memberId } : { memberId, casual } }).then(() => {
        setMemberId("");
        setCasual(false);
      }),
      full ? "Added to the waitlist" : "Booked in"
    );

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="tabular w-16 shrink-0 font-display text-xl font-semibold">{fmtTime(cls.startTime)}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{cls.name}</p>
          <p className="text-sm text-ink-soft">
            {cls.durationMinutes} min{cls.trainer?.name ?? cls.instructor ? `, ${cls.trainer?.name ?? cls.instructor}` : ""}
          </p>
        </div>
        <span className={full ? "text-sm font-medium text-warn" : "text-sm text-ink-soft"}>
          <span className="tabular">{cls.bookings.length}</span>/{cls.capacity}
          {cls.waitlist.length ? `, ${cls.waitlist.length} waiting` : ""}
        </span>
        <IconButton label={open ? `Hide roster for ${cls.name}` : `Show roster for ${cls.name}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          <Users className="h-[18px] w-[18px]" aria-hidden="true" />
        </IconButton>
        {can("classes.manage") ? (
          <IconButton label={`Cancel ${cls.name}`} onClick={() => setConfirmCancel(true)}>
            <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-4 border-t border-line bg-floor/50 px-4 py-4">
          {cls.bookings.length === 0 ? (
            <p className="text-sm text-ink-soft">No one booked yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded border border-line bg-surface">
              {cls.bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{b.member.name ?? b.member.email}</span>
                  <div className="flex items-center gap-1">
                    {canMarkAttendance ? (
                      <>
                        <Button
                          variant={b.status === "ATTENDED" ? "primary" : "secondary"}
                          aria-pressed={b.status === "ATTENDED"}
                          {...busy(`attended-${b.id}`)}
                          onClick={() => run(`attended-${b.id}`, () => api(`/api/classes/${cls.id}/book`, { method: "PATCH", body: { memberId: b.memberId, status: b.status === "ATTENDED" ? "BOOKED" : "ATTENDED" } }), "Attendance saved")}
                        >
                          Attended
                        </Button>
                        <Button
                          variant={b.status === "NO_SHOW" ? "danger" : "ghost"}
                          aria-pressed={b.status === "NO_SHOW"}
                          {...busy(`no-show-${b.id}`)}
                          onClick={() => run(`no-show-${b.id}`, () => api(`/api/classes/${cls.id}/book`, { method: "PATCH", body: { memberId: b.memberId, status: b.status === "NO_SHOW" ? "BOOKED" : "NO_SHOW" } }), "Attendance saved")}
                        >
                          No-show
                        </Button>
                      </>
                    ) : null}
                    {can("bookings.manage") ? (
                      <Button variant="ghost" {...busy(`remove-${b.id}`)} onClick={() => run(`remove-${b.id}`, () => api(`/api/classes/${cls.id}/book?memberId=${encodeURIComponent(b.memberId)}`, { method: "DELETE" }), "Booking cancelled")}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cls.waitlist.length > 0 ? (
            <div>
              <p className="mb-1 text-sm font-medium">Waitlist, in order</p>
              <ol className="divide-y divide-line rounded border border-line bg-surface">
                {cls.waitlist.map((w, i) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="tabular mr-2 text-ink-soft">{i + 1}.</span>
                      {w.member.name ?? w.member.email}
                    </span>
                    {can("bookings.manage") ? (
                      <div className="flex gap-1">
                        <Button variant="secondary" busy={pending === `promote-${w.id}`} disabled={full || (pending !== null && pending !== `promote-${w.id}`)} onClick={() => run(`promote-${w.id}`, () => api(`/api/classes/${cls.id}/waitlist/promote`, { body: { memberId: w.memberId } }), "Moved into the class")}>
                          Book in
                        </Button>
                        <Button variant="ghost" {...busy(`unwait-${w.id}`)} onClick={() => run(`unwait-${w.id}`, () => api(`/api/classes/${cls.id}/waitlist?memberId=${encodeURIComponent(w.memberId)}`, { method: "DELETE" }), "Removed from waitlist")}>
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {can("bookings.manage") ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SelectField label={full ? "Add to waitlist" : "Book a member"} value={memberId} onChange={(e) => setMemberId(e.target.value)} wrapperClassName="flex-1">
                <option value="">Choose a member</option>
                {members
                  .filter((m) => !taken.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
              </SelectField>
              <Button variant="secondary" busy={pending === "add"} disabled={!memberId || (pending !== null && pending !== "add")} onClick={addMember}>
                {full ? "Add to waitlist" : "Book in"}
              </Button>
            </div>
          ) : null}
          {can("bookings.manage") && !full ? (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-plate" checked={casual} onChange={(e) => setCasual(e.target.checked)} />
              <span>Casual visit: don&apos;t use one of their class credits (they pay the casual rate at the desk)</span>
            </label>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => run("cancel", () => api(`/api/classes/${cls.id}`, { method: "DELETE" }), "Class cancelled").then(() => setConfirmCancel(false))}
        busy={pending === "cancel"}
        title={`Cancel ${cls.name}?`}
        confirmLabel="Cancel class"
        body={`${cls.bookings.length} booking(s) and ${cls.waitlist.length} waitlist place(s) will be removed. Let those members know.`}
      />
    </li>
  );
}
