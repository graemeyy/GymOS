"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  ChevronRight, 
  Zap, 
  Bell, 
  Plus,
  ArrowLeft,
  Loader2
} from "lucide-react";

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-slate-900 rounded-none p-6 " + className}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "active" | "past_due" }) => {
  const styles = {
    default: "bg-white text-slate-900 border-slate-900",
    active: "bg-blue-600 text-white border-blue-600",
    past_due: "bg-rose-500 text-white border-rose-500",
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 border-2 uppercase tracking-widest ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default function MembersPage() {
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to fetch members");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20 selection:bg-blue-600 selection:text-white">
      {/* Navigation */}
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
              <a href="#" className="text-slate-400 hover:text-slate-900 transition-colors">Intelligence</a>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black text-xs">GY</div>
          </div>
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Node Registry</span>
            </div>
            <h1 className="text-7xl font-black tracking-tight uppercase leading-none mb-4">Members</h1>
            <p className="text-slate-900 text-lg font-black uppercase tracking-widest">
              Authorized Network Access Registry
            </p>
          </div>
          <div className="flex gap-4">
            <button className="bg-slate-900 text-white border-2 border-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-blue-600 transition-colors">
              <Plus className="w-4 h-4" /> New Member
            </button>
          </div>
        </header>

        <Card className="p-0 border-2 border-slate-900 overflow-hidden">
          <div className="bg-slate-50 border-b-2 border-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                placeholder="SEARCH REGISTRY..." 
                className="w-full bg-white border-2 border-slate-900 py-3 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex gap-4">
              <button className="border-2 border-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-all">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-white">
                  <th className="text-left p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Node Identity</th>
                  <th className="text-left p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Access Protocol</th>
                  <th className="text-left p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                  <th className="text-left p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Retention</th>
                  <th className="text-right p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      No Records Found in Registry
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id} className="hover:bg-blue-50 transition-colors group cursor-pointer">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black text-xs border-2 border-slate-900 group-hover:bg-blue-600 group-hover:border-blue-600 transition-colors">
                            {member.name?.[0] || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-tight">{member.name || "Anonymous Node"}</p>
                            <p className="text-[9px] text-slate-500 font-bold tracking-widest lowercase">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <Badge>{member.plan}</Badge>
                      </td>
                      <td className="p-6">
                        <Badge variant={member.status === 'ACTIVE' ? 'active' : 'past_due'}>{member.status}</Badge>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 border border-slate-200">
                            <div 
                              className={`h-full ${member.retentionScore > 70 ? 'bg-blue-600' : 'bg-slate-400'}`} 
                              style={{ width: `${member.retentionScore}%` }} 
                            />
                          </div>
                          <span className="text-[10px] font-black">{member.retentionScore}%</span>
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <button className="p-2 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-6 border-t-2 border-slate-900 bg-white flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Nodes: {members.length}</p>
            <div className="flex gap-2">
              <button disabled className="px-4 py-2 border-2 border-slate-100 text-slate-300 text-[10px] font-black uppercase">Prev</button>
              <button disabled className="px-4 py-2 border-2 border-slate-100 text-slate-300 text-[10px] font-black uppercase">Next</button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
