"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Activity, 
  DollarSign, 
  AlertCircle, 
  Wrench, 
  Plus, 
  TrendingUp, 
  Bell,
  ScanLine, 
  UserCheck, 
  Zap,
  Info,
  X,
  Loader2,
  ChevronRight,
  ShieldCheck
} from "lucide-react";

// ADHD-Friendly: Bold borders, strictly white/blue/slate-900, no shadows/blur
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-slate-900 rounded-none p-6 " + className}>
    {children}
  </div>
);

const Badge = ({ children, active = false }: { children: React.ReactNode, active?: boolean }) => {
  return (
    <span className={`text-[10px] font-black px-3 py-1 border-2 uppercase tracking-widest ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-900 border-slate-900'}`}>
      {children}
    </span>
  );
};

const MetricCard = ({ label, value, icon: Icon }: any) => (
  <Card className="flex flex-col gap-4">
    <div className="flex justify-between items-center">
      <div className="p-2 border-2 border-slate-900 text-slate-900">
        <Icon className="w-5 h-5" />
      </div>
      <Badge active>Live</Badge>
    </div>
    <div>
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  </Card>
);

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", plan: "BASIC" });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowMemberModal(false);
        setFormData({ name: "", email: "", plan: "BASIC" });
      } else {
        const err = await res.json();
        alert(err.error || "Enrollment failed.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20 selection:bg-blue-600 selection:text-white">
      
      {/* High Contrast Header */}
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
              <a href="/" className="text-blue-600 border-b-2 border-blue-600 pb-1">Command</a>
              <a href="/members" className="text-slate-400 hover:text-slate-900 transition-colors">Members</a>
              <a href="#" className="text-slate-400 hover:text-slate-900 transition-colors">Intelligence</a>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="w-10 h-10 border-2 border-slate-900 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black text-xs">GY</div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Symmetric Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16 border-b-4 border-slate-900 pb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Badge active>System Online</Badge>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Iron Sanctuary Node</span>
            </div>
            <h1 className="text-7xl font-black tracking-tight uppercase leading-none mb-4">Operations</h1>
            <p className="text-slate-900 text-lg font-black uppercase tracking-widest flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-600" />
              1,284 Active Nodes Managed
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowMemberModal(true)}
              className="bg-blue-600 text-white border-2 border-slate-900 px-10 py-5 text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-blue-700 active:translate-y-1 transition-all"
            >
              <Plus className="w-5 h-5" /> Enroll Node
            </button>
          </div>
        </header>

        {/* Symmetric 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          
          {/* Column 1: Core Metrics */}
          <div className="space-y-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">Network Stats</h3>
            <div className="space-y-6">
              <MetricCard label="Revenue" value="$42,850" icon={DollarSign} />
              <MetricCard label="Active Nodes" value="1,284" icon={Users} />
              <MetricCard label="Alerts" value="02" icon={AlertCircle} />
            </div>
          </div>

          {/* Column 2: Intelligence Feed */}
          <div className="space-y-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">Retention Intelligence</h3>
            <Card className="p-0 border-2 border-slate-900">
              <div className="divide-y-2 divide-slate-900">
                {[
                  { name: "Marcus Wright", score: 92 },
                  { name: "Elena Rodriguez", score: 32 },
                  { name: "Sarah Chen", score: 88 },
                  { name: "Tyler Durden", score: 15 },
                ].map((m, i) => (
                  <div key={i} className="p-6 flex items-center justify-between hover:bg-blue-50 transition-colors cursor-pointer group">
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight group-hover:text-blue-600">{m.name}</p>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Protocol Sync: {m.score}%</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-900" />
                  </div>
                ))}
              </div>
              <button className="w-full py-5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.4em] hover:bg-blue-600 transition-colors">Access Matrix</button>
            </Card>
          </div>

          {/* Column 3: System Status */}
          <div className="space-y-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">Hardware Sync</h3>
            <div className="space-y-6">
              <Card className="border-2 border-blue-600">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-blue-600 text-white border-2 border-slate-900">
                    <ScanLine className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight">Scanner Node</h4>
                    <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest mt-1">Live Sync Active</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { name: "John Wick", time: "08:12 AM" },
                    { name: "Sarah Connor", time: "07:42 AM" },
                  ].map((log, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b-2 border-slate-100 last:border-0">
                      <span className="text-xs font-black uppercase">{log.name}</span>
                      <span className="text-[10px] font-bold text-slate-400">{log.time}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-white border-2 border-slate-900">
                <div className="flex items-center gap-3 mb-4">
                  <Wrench className="w-5 h-5 text-blue-600" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Maintenance</h4>
                </div>
                <p className="text-[10px] font-bold text-slate-500 leading-tight">02 Components require manual intervention. Priority: HIGH.</p>
              </Card>
            </div>
          </div>

        </div>
      </main>

      {/* Enroll Modal - High Contrast */}
      {showMemberModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/80" onClick={() => setShowMemberModal(false)} />
          <div className="bg-white border-4 border-slate-900 p-10 max-w-md w-full relative z-[101]">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Enroll Node</h2>
              <button onClick={() => setShowMemberModal(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmitMember} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest">Legal Name</label>
                <input required className="w-full border-2 border-slate-900 p-4 text-sm font-black uppercase outline-none focus:bg-blue-50" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest">Email Connection</label>
                <input required type="email" className="w-full border-2 border-slate-900 p-4 text-sm font-black uppercase outline-none focus:bg-blue-50" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white border-2 border-slate-900 py-5 font-black uppercase tracking-widest hover:bg-blue-700 transition-colors">Authorize Access</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
