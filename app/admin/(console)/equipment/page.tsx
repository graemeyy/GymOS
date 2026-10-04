"use client";

import React, { useState } from "react";
import { Check, FileText, X } from "lucide-react";
import { api, useMutation, useResource } from "@/lib/client/api";
import { formatAud } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { EQUIPMENT_TEXT, EQUIPMENT_TONE } from "@/lib/equipment/labels";
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
  const equipment = useResource<Equipment[]>("/api/equipment");
  const approvals = useResource<Approval[]>("/api/agent-actions");
  const reloadAll = async () => {
    await Promise.all([equipment.reload(), approvals.reload()]);
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
                {can("products.edit") ? <ApprovalButtons approval={a} onDone={reloadAll} /> : null}
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
                  can("products.edit")
                    ? (e) =>
                        e.status === "OFFLINE" ? (
                          <DraftOrderButton equipment={e} onDone={reloadAll} />
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

// Each row owns its own request, so acting on one row never blocks another.
function ApprovalButtons({ approval, onDone }: { approval: Approval; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [answer, setAnswer] = useState<"APPROVED" | "REJECTED" | null>(null);
  const decide = useMutation(
    (status: "APPROVED" | "REJECTED") => {
      setAnswer(status);
      return api("/api/agent-actions", { method: "PATCH", body: { id: approval.id, status } });
    },
    {
      onSuccess: async (_result, status) => {
        toast(status === "APPROVED" ? "Approved" : "Rejected");
        await onDone();
      },
      onError: (e) => toast(e.message, "bad"),
    }
  );
  return (
    <div className="flex shrink-0 gap-2">
      {/* Both buttons wait for either answer, so an order can't be approved
          and rejected at once (R-57). */}
      <Button variant="secondary" busy={decide.busy && answer === "APPROVED"} disabled={decide.busy && answer === "REJECTED"} onClick={() => void decide.run("APPROVED")}>
        <Check className="h-4 w-4" aria-hidden="true" /> Approve
      </Button>
      <Button variant="ghost" busy={decide.busy && answer === "REJECTED"} disabled={decide.busy && answer === "APPROVED"} onClick={() => void decide.run("REJECTED")}>
        <X className="h-4 w-4" aria-hidden="true" /> Reject
      </Button>
    </div>
  );
}

function DraftOrderButton({ equipment, onDone }: { equipment: Equipment; onDone: () => Promise<void> }) {
  const toast = useToast();
  const draft = useMutation(() => api(`/api/equipment/${equipment.id}/po`, { method: "POST" }), {
    onSuccess: async () => {
      toast("Purchase order drafted");
      await onDone();
    },
    onError: (e) => toast(e.message, "bad"),
  });
  return (
    <IconButton label={`Draft a purchase order for ${equipment.name}`} disabled={draft.busy} onClick={() => void draft.run()}>
      <FileText className="h-4 w-4" aria-hidden="true" />
    </IconButton>
  );
}
