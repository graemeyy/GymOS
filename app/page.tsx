"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Activity, 
  DollarSign, 
  AlertTriangle, 
  ShieldCheck, 
  Wrench, 
  Plus, 
  TrendingUp, 
  Bell,
  Palette,
  ScanLine,
  UserCheck, 
  Zap,
  Info,
  X,
  Loader2
} from "lucide-react";

type BrandColor = "zinc" | "emerald" | "indigo" | "amber" | "rose" | "neon";

const BRAND_CONFIGS = {
  zinc: { primary: "#71717a", glow: "rgba(113, 113, 122, 0.15)" },
  emerald: { primary: "#10b981", glow: "rgba(16, 185, 129, 0.15)" },
  indigo: { primary: "#6366f1", glow: "rgba(99, 102, 241, 0.15)" },
  amber: { primary: "#f59e0b", glow: "rgba(245, 158, 11, 0.15)" },
  rose: { primary: "#f43f5e", glow: "rgba(244, 63, 94, 0.15)" },
  neon: { primary: "#00d2ff", glow: "rgba(0, 210, 255, 0.25)" },
};

const Card = ({ children, className = "", style = {} }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) => (
  <div 
    style={style}
    className={"glass-panel rounded-2xl p-5 hover:border-[var(--gym-brand)]/50 hover:shadow-[0_0_40px_var(--gym-brand-glow)] transition-all duration-700 " + className}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "warning" | "danger" | "success" | "brand" }) => {
  const styles = {
    default: "bg-zinc-800/50 text-zinc-300 border border-zinc-700/30",
    warning: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20",
    success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    brand: "bg-[var(--gym-brand-glow)] text-[var(--gym-brand)] border border-[var(--gym-brand)]/20",
  };
  return (
    <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider " + styles[variant]}>
      {children}
    </span>
  );
};

export default function DashboardPage() {
  const [brand, setBrand] = useState<BrandColor>("neon");
  const [mounted, setMounted] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({ name: "", email: "", plan: "BASIC" });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const currentBrand = BRAND_CONFIGS[brand];

  const brandStyles = {
    "--gym-brand": currentBrand.primary,
    "--gym-brand-glow": currentBrand.glow,
  } as React.CSSProperties;

  const handleAction = (name: string) => {
    setNotification({ message: `${name} initiated. System operational.`, type: 'info' });
  };

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
        setNotification({ message: "New member enrolled successfully.", type: 'success' });
        setShowMemberModal(false);
        setFormData({ name: "", email: "", plan: "BASIC" });
      } else {
        const err = await res.json();
        alert(err.error || "Enrollment failed.");
      }
    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <p className="text-zinc-400 font-bold uppercase tracking-[0.3em] animate-pulse">Initializing GymOS...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800 pb-20 overflow-x-hidden" style={brandStyles}>
      {/* Ambient background glow */}
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-[var(--gym-brand-glow)] rounded-full blur-[160px] pointer-events-none opacity-30 z-0" />
      
      {/* Notifications */}
      {notification && (
        <div className="fixed top-24 right-6 z-[100] animate-in slide-in-from-right fade-in duration-500">
          <div className={`px-6 py-3 rounded-xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
            <Zap className="w-4 h-4 fill-current" />
            <span className="text-xs font-bold uppercase tracking-wider">{notification.message}</span>
          </div>
        </div>
      )}

      {/* New Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMemberModal(false)} />
          <Card className="w-full max-w-md relative animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black tracking-tight">New Member Enrollment</h2>
              <button onClick={() => setShowMemberModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitMember} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Full Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[var(--gym-brand)] focus:outline-none transition-colors"
                  placeholder="e.g. Jax Teller"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Email Address</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[var(--gym-brand)] focus:outline-none transition-colors"
                  placeholder="jax@reaper.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Membership Tier</label>
                <select 
                  value={formData.plan}
                  onChange={(e) => setFormData({...formData, plan: e.target.value})}
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[var(--gym-brand)] focus:outline-none transition-colors appearance-none"
                >
                  <option value="BASIC">Basic Sanctuary</option>
                  <option value="PREMIUM">Premium Obsidian</option>
                  <option value="PLATINUM">Platinum Elite</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[var(--gym-brand)] text-black py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_0_20px_var(--gym-brand-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize Enrollment"}
              </button>
            </form>
          </Card>
        </div>
      )}

      <nav className="border-b border-zinc-900/50 bg-[#09090b]/80 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 group cursor-pointer">
               <div className="w-8 h-8 rounded-xl bg-[var(--gym-brand)] flex items-center justify-center shadow-[0_0_25px_var(--gym-brand-glow)] group-hover:scale-110 transition-transform duration-500">
                 <Zap className="w-4 h-4 text-black fill-black" />
               </div>
               <span className="text-xl font-bold tracking-tighter text-white">GymOS</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              <a href="#" className="text-[var(--gym-brand)] transition-colors">Overview</a>
              <a href="#" className="hover:text-zinc-200 transition-colors">Members</a>
              <a href="#" className="hover:text-zinc-200 transition-colors">Staff</a>
              <a href="#" className="hover:text-zinc-200 transition-colors">Settings</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-400 hover:text-white transition-colors relative group">
                <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-[var(--gym-brand)] rounded-full border border-zinc-950 shadow-[0_0_8px_var(--gym-brand-glow)]" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-300 hover:border-zinc-700 transition-colors cursor-pointer">GY</div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-6 py-12 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <h1 className="text-7xl font-black tracking-tighter text-white mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">Iron Sanctuary</h1>
            <p className="text-zinc-400 text-sm flex items-center gap-3 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gym-brand)]/75 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--gym-brand)] shadow-[0_0_12px_var(--gym-brand-glow)]"></span>
              </span>
              System Online — Facilitating Peak Performance
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => handleAction("Diagnostic Report Generation")}
              className="bg-zinc-900/40 border border-zinc-800/40 hover:bg-zinc-800/60 text-zinc-300 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all backdrop-blur-md"
            >
              Reports
            </button>
            <button 
              onClick={() => setShowMemberModal(true)}
              className="bg-[var(--gym-brand)] text-black hover:scale-[1.02] active:scale-[0.98] px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all shadow-[0_0_30px_var(--gym-brand-glow)]"
            >
              <Plus className="w-4 h-4" /> New Member
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">Gym Vitals</h3>
            <div className="grid gap-4">
                {[
                  { label: "Members", value: "1,284", icon: Users, color: "text-[var(--gym-brand)]", glow: "shadow-[0_0_20px_var(--gym-brand-glow)]" },
                  { label: "Check-ins", value: "42", icon: Activity, color: "text-[var(--gym-brand)]", glow: "shadow-[0_0_20px_var(--gym-brand-glow)]" },
                  { label: "Revenue", value: "$42.8k", icon: DollarSign, color: "text-white", glow: "" },
                  { label: "At-Risk", value: "12", icon: AlertTriangle, color: "text-amber-400", glow: "shadow-[0_0_20px_rgba(251,191,36,0.15)]" },
                ].map((stat) => (
                  <Card key={stat.label} className={"group cursor-default py-5 " + stat.glow}>
                    <div className="flex items-center gap-5">
                      <div className={"p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50 group-hover:border-[var(--gym-brand)]/50 transition-colors " + stat.color}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5">{stat.label}</p>
                        <p className="text-2xl font-black text-white tracking-tighter">{stat.value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>

            <Card className="mt-8 border-[var(--gym-brand)]/10 bg-gradient-to-b from-zinc-900/20 to-zinc-950/60">
              <div className="flex items-center gap-3 mb-8">
                <Palette className="w-4 h-4 text-[var(--gym-brand)]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-200">Brand Mode</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-8 leading-relaxed font-medium">Shift the system accent and ambient glow across the dashboard.</p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(BRAND_CONFIGS) as BrandColor[]).map((c) => (
                  <button 
                    key={c}
                    onClick={() => setBrand(c)}
                    className={"h-10 rounded-xl border-2 transition-all duration-500 " + (brand === c ? 'border-white scale-110 shadow-[0_0_15px_var(--gym-brand-glow)]' : 'border-transparent hover:scale-105 opacity-60 hover:opacity-100')}
                    style={{ backgroundColor: BRAND_CONFIGS[c].primary }}
                  />
                ))}
              </div>
              <div className="mt-8 pt-8 border-t border-zinc-900/50">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Profile</span>
                    <Badge variant="brand">{brand}</Badge>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">Autonomous Operations</h3>
            <Card className="p-0 overflow-hidden group">
               <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/60 backdrop-blur-md">
                 <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-[var(--gym-brand-glow)] rounded-xl border border-[var(--gym-brand)]/20">
                      <ShieldCheck className="w-5 h-5 text-[var(--gym-brand)]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white tracking-tight">Churn Shield</h4>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Predictive Retention Agent</p>
                    </div>
                 </div>
                 <Badge variant="brand">Active</Badge>
               </div>
               <div className="divide-y divide-zinc-900/40">
                  {[
                    { name: "Marcus Wright", plan: "Pro", score: 88, status: "Active" },
                    { name: "Elena Rodriguez", plan: "Basic", score: 32, status: "At Risk" },
                    { name: "Sarah Chen", plan: "Pro", score: 94, status: "Active" },
                  ].map((m, i) => (
                    <div key={i} className="p-5 flex items-center justify-between hover:bg-[var(--gym-brand-glow)] transition-all duration-500 cursor-pointer group/row">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/50 flex items-center justify-center text-xs font-black text-zinc-300 group-hover/row:border-[var(--gym-brand)]/50 group-hover/row:text-white transition-all">
                            {m.name[0]}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-zinc-200 group-hover/row:text-white transition-colors">{m.name}</p>
                             <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em]">{m.plan} Membership</p>
                           </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-1">Score</p>
                          <p className={"text-sm font-black tracking-tighter " + (m.score > 70 ? 'text-[var(--gym-brand)]' : 'text-amber-500')}>{m.score}%</p>
                        </div>
                    </div>
                  ))}
               </div>
               <div className="p-4 bg-zinc-950/80 text-center border-t border-zinc-900/50">
                 <button onClick={() => handleAction("Neural Insight Processing")} className="text-[9px] font-black text-zinc-400 hover:text-[var(--gym-brand)] transition-colors uppercase tracking-[0.3em]">Neural Network Insights</button>
               </div>
            </Card>

            <Card className="p-0 overflow-hidden border-[var(--gym-brand)]/10">
               <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/60 backdrop-blur-md">
                 <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-[var(--gym-brand-glow)] rounded-xl border border-[var(--gym-brand)]/20">
                      <Wrench className="w-5 h-5 text-[var(--gym-brand)]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white tracking-tight">Maintenance Oracle</h4>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">IoT Equipment Monitoring</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gym-brand)] animate-pulse" />
                    <span className="text-[10px] font-black text-[var(--gym-brand)] uppercase tracking-widest">2 Alerts</span>
                 </div>
               </div>
               <div className="p-6 space-y-4">
                  <div className="p-5 rounded-2xl bg-[var(--gym-brand-glow)]/40 border border-[var(--gym-brand)]/20 flex items-start justify-between group/alert hover:bg-[var(--gym-brand-glow)] transition-all duration-500">
                    <div>
                      <p className="text-xs font-bold text-zinc-200 group-hover/alert:text-white transition-colors">Treadmill #4 - Motor Heat</p>
                      <p className="text-[10px] text-zinc-400 mt-1.5 font-medium leading-relaxed">Critical thermal limit detected. High probability of core failure within 72 hours.</p>
                    </div>
                    <button onClick={() => handleAction("Service Ticket")} className="p-2 bg-[var(--gym-brand-glow)] hover:bg-[var(--gym-brand-glow)]/80 rounded-lg transition-all text-[var(--gym-brand)]">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5 rounded-2xl bg-zinc-950/50 border border-zinc-900 flex items-start justify-between opacity-50 hover:opacity-100 transition-all duration-500">
                    <div>
                      <p className="text-xs font-bold text-zinc-300">Rowing Machine B - Chain Tension</p>
                      <p className="text-[10px] text-zinc-400 mt-1.5 font-medium">Routine maintenance recommended for peak efficiency next week.</p>
                    </div>
                    <Info className="w-4 h-4 text-zinc-500" />
                  </div>
               </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-1">Scanner Node</h3>
            <Card className="p-0 overflow-hidden">
               <div 
                onClick={() => handleAction("Biometric Node Calibration")}
                className="p-10 bg-zinc-950/80 flex flex-col items-center justify-center border-b border-zinc-900/50 relative group cursor-pointer overflow-hidden"
               >
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--gym-brand-glow)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative">
                    <div className="absolute -inset-8 bg-[var(--gym-brand-glow)] rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse" />
                    <ScanLine className="w-20 h-20 text-[var(--gym-brand)] relative z-10 group-hover:scale-110 transition-transform duration-700" />
                  </div>
                  <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 group-hover:text-white transition-colors relative z-10">Initialize Scan</p>
                  <p className="mt-2 text-[9px] text-zinc-500 font-bold uppercase tracking-widest relative z-10">Sensor Status: Standby</p>
               </div>
               
               <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Access Log</h5>
                    <div className="flex items-center gap-2">
                       <span className="w-1 h-1 rounded-full bg-[var(--gym-brand)] animate-pulse" />
                       <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Realtime</span>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {[
                      { name: "John Wick", time: "08:12 AM", type: "Member", status: "Success" },
                      { name: "Tyler Durden", time: "07:55 AM", type: "Guest", status: "Success" },
                      { name: "Sarah Connor", time: "07:42 AM", type: "Member", status: "Warning" },
                    ].map((log, i) => (
                      <div key={i} className="flex items-center justify-between group/log">
                        <div className="flex items-center gap-4">
                           <div className={"w-0.5 h-8 rounded-full " + (log.status === 'Success' ? 'bg-[var(--gym-brand)]/40' : 'bg-amber-500/40')} />
                           <div>
                             <p className="text-xs font-bold text-zinc-200 group-hover/log:text-white transition-colors">{log.name}</p>
                             <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{log.time} <span className="mx-1 opacity-30">|</span> {log.type}</p>
                           </div>
                        </div>
                        <button className="opacity-0 group-hover/log:opacity-100 p-2 hover:bg-zinc-900 rounded-xl transition-all duration-300">
                          <UserCheck className="w-4 h-4 text-zinc-400 hover:text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="p-5 bg-zinc-950/90 border-t border-zinc-900/50">
                  <div className="flex gap-3">
                    <button onClick={() => handleAction("Manual Access Override")} className="flex-1 bg-zinc-900/50 border border-zinc-800/50 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:border-zinc-700 transition-all">Manual Override</button>
                    <button onClick={() => handleAction("Guest Pass Issuance")} className="flex-1 bg-zinc-900/50 border border-zinc-800/50 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:border-zinc-700 transition-all">Issue Guest</button>
                  </div>
               </div>
            </Card>

            <Card className="p-8 bg-gradient-to-br from-[#09090b] to-zinc-900/40 border-[var(--gym-brand)]/10 hover:border-[var(--gym-brand)]/30 transition-all duration-700">
              <div className="flex items-center gap-3 mb-8">
                <TrendingUp className="w-4 h-4 text-[var(--gym-brand)]/70" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Peak Forecast</h3>
              </div>
              <div className="flex items-end justify-between h-24 gap-1.5 mb-6 group/chart">
                {[30, 45, 60, 85, 100, 75, 50, 40, 60, 90, 80, 45].map((h, i) => (
                  <div 
                    key={i} 
                    style={{ height: h + "%" }} 
                    className={"flex-1 rounded-t-lg transition-all duration-1000 " + (h > 80 ? 'bg-rose-500/30' : 'bg-[var(--gym-brand)]/20 group-hover/chart:bg-[var(--gym-brand)]/40')} 
                  />
                ))}
              </div>
              <div className="bg-[var(--gym-brand-glow)] border border(--gym-brand)]/20 rounded-full py-2 px-4">
                <p className="text-[9px] text-[var(--gym-brand)] text-center font-black uppercase tracking-[0.2em]">Expected Peak: 17:00 - 19:00</p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
