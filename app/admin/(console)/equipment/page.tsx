"use client";

import React, { useState } from "react";
import { Check, FileText, X } from "lucide-react";
import { api, ApiClientError, useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { fmtDate } from "@/lib/client/format";
import { EQUIPMENT_TEXT, EQUIPMENT_TONE } from "@/lib/client/labels";
import { useStaff } from "@/components/admin/staff-session";
import { Button, IconButton, PageHeader, Panel, PanelHeader, StatusTag } from "@/components/ui/primitives";
import { AsyncBlock, EmptyState, useToast } from "@/components/ui/feedback";
import { DataList } from "@/components/ui/data-list";

interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  status: keyof typeof EQUIPMENT_TEXT;
  lastServicedAt: string | null;
  partNeeded: string | null;
  estimatedCost: number | null;
}
interface Approval {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export default function EquipmentPage() {
  const { can } = useStaff();
  const toast = useToast();
  const equipment = useResource<Equipment[]>("/api/equipment");
  const approvals = useResource<Approval[]>("/api/agent-actions");
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await fn();
      toast(success);
      await Promise.all([equipment.reload(), approvals.reload()]);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "That didn't work.", "bad");
    } finally {
      setBusyId(null);
    }
  };

  const pending = approvals.data?.filter((a) => a.status === "PENDING") ?? [];

  return (
    <>
      <PageHeader title="Equipment" description="What's working, what needs a look, and repairs waiting for approval." />
      {pending.length > 0 ? (
        <Panel className="mb-6" aria-labelledby="approvals-heading">
          <PanelHeader id="approvals-heading" title="Purchase orders to approve" />
          <ul className="divide-y divide-line">
            {pending.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-ink-soft">{a.description}</p>
                </div>
                {can("equipment:manage") ? (
                  <div className="flex shrink-0 gap-2">
                    {/* Both buttons wait for either answer, so an order can't be
                        approved and rejected at once (R-57). */}
                    <Button variant="secondary" busy={busyId === `${a.id}:approve`} disabled={busyId === `${a.id}:reject`} onClick={() => act(`${a.id}:approve`, () => api("/api/agent-actions", { method: "PATCH", body: { id: a.id, status: "APPROVED" } }), "Approved")}>
                      <Check className="h-4 w-4" aria-hidden="true" /> Approve
                    </Button>
                    <Button variant="ghost" busy={busyId === `${a.id}:reject`} disabled={busyId === `${a.id}:approve`} onClick={() => act(`${a.id}:reject`, () => api("/api/agent-actions", { method: "PATCH", body: { id: a.id, status: "REJECTED" } }), "Rejected")}>
                      <X className="h-4 w-4" aria-hidden="true" /> Reject
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel>
        <AsyncBlock loading={equipment.loading} error={equipment.error} data={equipment.data} onRetry={equipment.reload}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No equipment recorded" />
              </div>
            ) : (
              <DataList
                caption="Equipment"
                rows={rows}
                rowKey={(e) => e.id}
                columns={[
                  {
                    header: "Equipment",
                    primary: true,
                    cell: (e) => (
                      <div>
                        <p className="font-medium">{e.name}</p>
                        {e.serialNumber ? <p className="text-sm text-ink-soft">Serial {e.serialNumber}</p> : null}
                      </div>
                    ),
                  },
                  { header: "Condition", cell: (e) => <StatusTag tone={EQUIPMENT_TONE[e.status]}>{EQUIPMENT_TEXT[e.status]}</StatusTag> },
                  { header: "Last serviced", cell: (e) => (e.lastServicedAt ? fmtDate(e.lastServicedAt) : "Unknown") },
                  { header: "Repair", cell: (e) => (e.partNeeded ? `${e.partNeeded}${e.estimatedCost != null ? `, about ${formatAud(e.estimatedCost)}` : ""}` : <span className="text-ink-soft">None needed</span>) },
                ]}
                actions={
                  can("equipment:manage")
                    ? (e) =>
                        e.status === "OFFLINE" ? (
                          <IconButton label={`Draft a purchase order for ${e.name}`} disabled={busyId === e.id} onClick={() => act(e.id, () => api(`/api/equipment/${e.id}/po`, { method: "POST" }), "Purchase order drafted")}>
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          </IconButton>
                        ) : null
                    : undefined
                }
              />
            )
          }
        </AsyncBlock>
      </Panel>
    </>
  );
}
