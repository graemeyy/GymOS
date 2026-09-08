"use client";

import React, { useState, useEffect } from "react";
import { Search, UserPlus, X, Edit2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHeader, Button, Badge, EmptyState } from "@/components/ui";

interface Member {
  id: string;
  name: string;
  email: string;
  status: string;
  plan: string;
  createdAt: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", status: "ACTIVE", plan: "BASIC" });

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/members");
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingMember ? "PUT" : "POST";
    const body = editingMember ? { ...formData, id: editingMember.id } : formData;

    try {
      const res = await fetch("/api/members", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingMember(null);
        setFormData({ name: "", email: "", status: "ACTIVE", plan: "BASIC" });
        fetchMembers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this member? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/members?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({ name: member.name, email: member.email, status: member.status, plan: member.plan });
    setIsModalOpen(true);
  };

  const openNew = () => {
    setEditingMember(null);
    setFormData({ name: "", email: "", status: "ACTIVE", plan: "BASIC" });
    setIsModalOpen(true);
  };

  const filtered = members.filter((m) => {
    const q = query.toLowerCase();
    return !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
  });

  return (
    <AppShell>
      <PageHeader
        title="Members"
        description="Everyone with an active or past membership."
        action={
          <Button onClick={openNew}>
            <UserPlus className="w-4 h-4" /> Add member
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-line">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
            <input
              type="text"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-chalk border border-line rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
            />
          </div>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-ink-soft">Loading members…</p>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState>{query ? "No members match your search." : "No members yet — add your first one."}</EmptyState>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft border-b border-line">
                <th className="font-medium px-6 py-3">Member</th>
                <th className="font-medium px-6 py-3">Status</th>
                <th className="font-medium px-6 py-3">Plan</th>
                <th className="font-medium px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((member) => (
                <tr key={member.id} className="hover:bg-surface-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-ember-soft text-ember-dark flex items-center justify-center text-xs font-medium">
                        {member.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{member.name}</p>
                        <p className="text-xs text-ink-soft">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={member.status === "ACTIVE" ? "good" : "neutral"}>{member.status}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge>{member.plan}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(member)}
                        aria-label={`Edit ${member.name}`}
                        className="p-2 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        aria-label={`Remove ${member.name}`}
                        className="p-2 rounded-lg text-ink-soft hover:bg-bad-soft hover:text-bad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/30">
          <Card className="w-full max-w-md relative">
            <button
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              className="absolute right-5 top-5 p-1.5 rounded-lg text-ink-soft hover:bg-surface-muted"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="font-display text-xl font-medium text-ink mb-6">
              {editingMember ? "Edit member" : "Add member"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Full name</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  placeholder="Jordan Casey"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Email address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  placeholder="jordan@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Plan</label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  >
                    <option value="BASIC">Basic</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="PLATINUM">Platinum</option>
                    <option value="ELITE">Elite</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                    <option value="CANCELED">Canceled</option>
                    <option value="PAST_DUE">Past due</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full mt-2">
                {editingMember ? "Save changes" : "Add member"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
