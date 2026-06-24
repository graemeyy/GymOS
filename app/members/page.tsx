"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  UserPlus, 
  Zap,
  ArrowLeft,
  X,
  Edit2,
  Trash2,
  Check
} from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  status: string;
  plan: string;
  createdAt: string;
}

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-slate-900 rounded-none p-6 " + className}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "success" | "danger" }) => {
  const styles = {
    default: "bg-white text-slate-900 border-slate-900",
    success: "bg-blue-600 text-white border-blue-600",
    danger: "bg-rose-600 text-white border-rose-600",
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 border-2 uppercase tracking-widest ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
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
        body: JSON.stringify(body)
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
    if (!confirm("Are you sure? This action is permanent.")) return;
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

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20 selection:bg-blue-600 selection:text-white">
      <nav className="border-b-4 border-slate-900 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 flex items-center justify-center border-2 border-slate-900">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <span className="text-2xl font-black tracking-tighter uppercase">GymOS</span>
            </div>
            <div className="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.25em]">
              <a href="/" className="text-slate-400 hover:text-slate-900 transition-colors">Command</a>
              <a href="/members" className="text-blue-600 border-b-2 border-blue-600 pb-1">Members</a>
              <a href="/billing" className="text-slate-400 hover:text-slate-900 transition-colors">Financials</a>
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black text-xs">GY</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-16">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16 border-b-4 border-slate-900 pb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <a href="/" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
                <ArrowLeft className="w-3 h-3" /> Dashboard
              </a>
              <span className="text-slate-300">|</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Iron Sanctuary Registry</span>
            </div>
            <h1 className="text-7xl font-black tracking-tight uppercase leading-none mb-4">Members</h1>
            <p className="text-slate-900 text-lg font-black uppercase tracking-widest">Global Athlete Database</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => { setEditingMember(null); setFormData({ name: "", email: "", status: "ACTIVE", plan: "BASIC" }); setIsModalOpen(true); }}
              className="bg-blue-600 text-white border-2 border-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-blue-700 transition-all active:translate-y-1"
            >
              <UserPlus className="w-4 h-4" /> Enroll Member
            </button>
          </div>
        </header>

        <Card className="p-0 overflow-hidden border-4 border-slate-900 mb-10">
          <div className="bg-slate-50 border-b-2 border-slate-900 p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="SEARCH BY NAME OR EMAIL..." className="w-full bg-white border-2 border-slate-900 pl-12 pr-4 py-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <button className="border-2 border-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-white border-b-2 border-slate-900">
              <tr>
                <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest border-r-2 border-slate-100">Member</th>
                <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest border-r-2 border-slate-100">Status</th>
                <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest border-r-2 border-slate-100">Protocol</th>
                <th className="text-right p-6 text-[10px] font-black uppercase tracking-widest">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center font-black uppercase tracking-widest animate-pulse">Scanning database...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center font-black uppercase tracking-widest">No athletes detected.</td></tr>
              ) : members.map((member) => (
                <tr key={member.id} className="group hover:bg-blue-50 transition-colors">
                  <td className="p-6 border-r-2 border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black text-xs border-2 border-slate-900">
                        {member.name[0]}
                      </div>
                      <div>
                        <p className="font-black uppercase text-sm leading-tight">{member.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 border-r-2 border-slate-100">
                    <Badge variant={member.status === 'ACTIVE' ? 'success' : 'default'}>{member.status}</Badge>
                  </td>
                  <td className="p-6 border-r-2 border-slate-100">
                    <Badge variant="default">{member.plan}</Badge>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(member)} className="p-2 border-2 border-slate-900 hover:bg-blue-600 hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(member.id)} className="p-2 border-2 border-slate-900 hover:bg-rose-600 hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/50 backdrop-none">
          <Card className="w-full max-w-xl border-4 border-slate-900 shadow-[20px_20px_0px_0px_rgba(15,23,42,1)] relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 p-2 border-2 border-slate-900 hover:bg-rose-600 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-3xl font-black uppercase tracking-tight mb-8">
              {editingMember ? "Update Athlete" : "Enroll Athlete"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white border-2 border-slate-900 p-4 font-black uppercase text-xs focus:ring-4 focus:ring-blue-600/20 focus:outline-none" 
                  placeholder="e.g. JOHN WICK"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest">Email Address</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-white border-2 border-slate-900 p-4 font-black uppercase text-xs focus:ring-4 focus:ring-blue-600/20 focus:outline-none" 
                  placeholder="CONTRACTOR@CONTINENTAL.ORG"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Membership Plan</label>
                  <select 
                    value={formData.plan}
                    onChange={e => setFormData({...formData, plan: e.target.value})}
                    className="w-full bg-white border-2 border-slate-900 p-4 font-black uppercase text-xs focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="ELITE">ELITE</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest">Initial Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-white border-2 border-slate-900 p-4 font-black uppercase text-xs focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white border-2 border-slate-900 py-6 font-black uppercase tracking-[0.4em] hover:bg-blue-700 transition-all active:translate-y-1">
                {editingMember ? "Commit Changes" : "Finalize Enrollment"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
