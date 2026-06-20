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
  Info
} from "lucide-react";

type BrandColor = "zinc" | "emerald" | "indigo" | "amber" | "rose";

const BRAND_CONFIGS = {
  zinc: { primary: "#71717a", glow: "rgba(113, 113, 122, 0.15)" },
  emerald: { primary: "#10b981", glow: "rgba(16, 185, 129, 0.15)" },
  indigo: { primary: "#6366f1", glow: "rgba(99, 102, 241, 0.15)" },
  amber: { primary: "#f59e0b", glow: "rgba(245, 158, 11, 0.15)" },
  rose: { primary: "#f43f5e", glow: "rgba(244, 63, 94, 0.15)" },
};

const Card = ({ children, className = "", style = {} }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) => (
  <div 
    style={style}
    className={"bg-zinc-900/20 border border-zinc-800/40 backdrop-blur-xl rounded-2xl p-5 hover:border-[var(--gym-brand)]/30 hover:shadow-[0_0_30px_var(--gym-brand-glow)] transition-all duration-500 " + className}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "warning" | "danger" | "success" | "brand" }) => {
  const styles = {
    default: "bg-zinc-800/50 text-zinc-400 border border-zinc-700/30",
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
  const [brand, setBrand] = useState<BrandColor>("emerald");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentBrand = BRAND_CONFIGS[brand];

  const brandStyles = {
    "--gym-brand": currentBrand.primary,
    "--gym-brand-glow": currentBrand.glow,
  } as React.CSSProperties;

  if (!mounted) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 pb-20 overflow-x-hidden" style={brandStyles}>
      {/* Ambient background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[var(--gym-brand-glow)] rounded-full blur-[120px] pointer-events-none opacity-20 z-0" />
      
      <nav className="border-b border-zinc-900/50 bg-zinc-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 group cursor-pointer">
               <div className="w-8 h-8 rounded-xl bg-[var(--gym-brand)] flex items-center justify-center shadow-[0_0_20px_var(--gym-brand-glow)] group-hover:scale-110 transition-transform duration-500">
                 <Zap className="w-4 h-4 text-black fill-black" />
               </div>
               <span className="text-xl font-bold tracking-tighter text-white">GymOS</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              <a href="#" className="text-[var(--gym-brand)] transition-colors">Overview</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Members</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Staff</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Settings</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-500 hover:text-white transition-colors relative group">
                <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-[var(--gym-brand)] rounded-full border border-zinc-950 shadow-[0_0_8px_var(--gym-brand-glow)]" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 hover:border-zinc-700 transition-colors cursor-pointer">GY</div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-6 py-12 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <h1 className="text-6xl font-black tracking-tighter text-white mb-3">Iron Sanctuary</h1>
            <p className="text-zinc-500 text-sm flex items-center gap-3 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gym-brand)]/75 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--gym-brand)] shadow-[0_0_8px_var(--gym-brand-glow)]"></span>
              </span>
              System Online — Facilitating Peak Performance
            </p>
          </div>
          <div className="flex gap-3">
            <button className="bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/80 text-zinc-400 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all backdrop-blur-md">
              Reports
            </button>
            <button className="bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]">
              <Plus className="w-4 h-4" /> New Member
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 px-1">Gym Vitals</h3>
            <div className="grid gap-4">
                {[
                  { label: "Members", value: "1,284", icon: Users, color: "text-[var(--gym-brand)]", glow: "shadow-[0_0_15px_var(--gym-brand-glow)]" },
                  { label: "Check-ins", value: "42", icon: Activity, color: "text-[var(--gym-brand)]", glow: "shadow-[0_0_15px_var(--gym-brand-glow)]" },
                  { label: "Revenue", value: "$42.8k", icon: DollarSign, color: "text-white", glow: "" },
                  { label: "At-Risk", value: "12", icon: AlertTriangle, color: "text-amber-400", glow: "shadow-[0_0_15px_rgba(251,191,36,0.1)]" },
                ].map((stat) => (
                  <Card key={stat.label} className={"group cursor-default py-5 border-zinc-800/30 " + stat.glow}>
                    <div className="flex items-center gap-5">
                      <div className={"p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50 group-hover:border-[var(--gym-brand)]/50 transition-colors " + stat.color}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5">{stat.label}</p>
                        <p className="text-2xl font-black text-white tracking-tighter">{stat.value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>

            <Card className="mt-8 border-[var(--gym-brand)]/10 bg-gradient-to-b from-zinc-900/10 to-zinc-950/40">
              <div className="flex items-center gap-3 mb-8">
                <Palette className="w-4 h-4 text-[var(--gym-brand)]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">Brand Mode</h3>
              </div>
              <p className="text-xs text-zinc-500 mb-8 leading-relaxed font-medium">Shift the system accent and ambient glow across the dashboard.</p>
              <div className="grid grid-cols-5 gap-3">
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
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Active Profile</span>
                    <Badge variant="brand">{brand}</Badge>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 px-1">Autonomous Operations</h3>
            <Card className="p-0 overflow-hidden group border-zinc-800/30">
               <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/40 backdrop-blur-md">
                 <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-[var(--gym-brand-glow)] rounded-xl border border-[var(--gym-brand)]/10">
                      <ShieldCheck className="w-5 h-5 text-[var(--gym-brand)]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white tracking-tight">Churn Shield</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Predictive Retention Agent</p>
                    </div>
                 </div>
                 <Badge variant="brand">Active</Badge>
               </div>
               <div className="divide-y divide-zinc-900/30">
                  {[
                    { name: "Marcus Wright", plan: "Pro", score: 88, status: "Active" },
                    { name: "Elena Rodriguez", plan: "Basic", score: 32, status: "At Risk" },
                    { name: "Sarah Chen", plan: "Pro", score: 94, status: "Active" },
                  ].map((m, i) => (
                    <div key={i} className="p-5 flex items-center justify-between hover:bg-[var(--gym-brand-glow)] transition-all duration-500 cursor-pointer group/row">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/50 flex items-center justify-center text-xs font-black text-zinc-400 group-hover/row:border-[var(--gym-brand)]/50 group-hover/row:text-white transition-all">
                            {m.name[0]}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-zinc-200 group-hover/row:text-white transition-colors">{m.name}</p>
                             <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em]">{m.plan} Membership</p>
                           </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Score</p>
                          <p className={"text-sm font-black tracking-tighter " + (m.score > 70 ? 'text-[var(--gym-brand)]' : 'text-amber-500')}>{m.score}%</p>
                        </div>
                    </div>
                  ))}
               </div>
               <div className="p-4 bg-zinc-950/60 text-center border-t border-zinc-900/50">
                 <button className="text-[9px] font-black text-zinc-500 hover:text-[var(--gym-brand)] transition-colors uppercase tracking-[0.3em]">Neural Network Insights</button>
               </div>
            </Card>

            <Card className="p-0 overflow-hidden border-[var(--gym-brand)]/5">
               <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/40 backdrop-blur-md">
                 <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-[var(--gym-brand-glow)] rounded-xl border border-[var(--gym-brand)]/10">
                      <Wrench className="w-5 h-5 text-[var(--gym-brand)]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white tracking-tight">Maintenance Oracle</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">IoT Equipment Monitoring</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gym-brand)] animate-pulse" />
                    <span className="text-[10px] font-black text-[var(--gym-brand)] uppercase tracking-widest">2 Alerts</span>
                 </div>
               </div>
               <div className="p-6 space-y-4">
                  <div className="p-5 rounded-2xl bg-[var(--gym-brand-glow)]/50 border border-[var(--gym-brand)]/10 flex items-start justify-between group/alert hover:bg-[var(--gym-brand-glow)] transition-all duration-500">
                    <div>
                      <p className="text-xs font-bold text-zinc-200 group-hover/alert:text-white transition-colors">Treadmill #4 - Motor Heat</p>
                      <p className="text-[10px] text-zinc-500 mt-1.5 font-medium leading-relaxed">Critical thermal limit detected. High probability of core failure within 72 hours.</p>
                    </div>
                    <button className="p-2 bg-[var(--gym-brand-glow)] hover:bg-[var(--gym-brand-glow)]/80 rounded-lg transition-all text-[var(--gym-brand)]">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5 rounded-2xl bg-zinc-950/50 border border-zinc-900 flex items-start justify-between opacity-50 hover:opacity-100 transition-all duration-500">
                    <div>
                      <p className="text-xs font-bold text-zinc-400">Rowing Machine B - Chain Tension</p>
                      <p className="text-[10px] text-zinc-600 mt-1.5 font-medium">Routine maintenance recommended for peak efficiency next week.</p>
                    </div>
                    <Info className="w-4 h-4 text-zinc-800" />
                  </div>
               </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 px-1">Scanner Node</h3>
            <Card className="p-0 overflow-hidden border-zinc-800/30">
               <div className="p-10 bg-zinc-950/80 flex flex-col items-center justify-center border-b border-zinc-900/50 relative group cursor-pointer overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--gym-brand-glow)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative">
                    <div className="absolute -inset-8 bg-[var(--gym-brand-glow)] rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse" />
                    <ScanLine className="w-20 h-20 text-[var(--gym-brand)] relative z-10 group-hover:scale-110 transition-transform duration-700" />
                  </div>
                  <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 group-hover:text-white transition-colors relative z-10">Initialize Scan</p>
                  <p className="mt-2 text-[9px] text-zinc-700 font-bold uppercase tracking-widest relative z-10">Sensor Status: Standby</p>
               </div>
               
               <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Access Log</h5>
                    <div className="flex items-center gap-2">
                       <span className="w-1 h-1 rounded-full bg-[var(--gym-brand)] animate-pulse" />
                       <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Realtime</span>
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
                             <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{log.time} <span className="mx-1 opacity-30">|</span> {log.type}</p>
                           </div>
                        </div>
                        <button className="opacity-0 group-hover/log:opacity-100 p-2 hover:bg-zinc-900 rounded-xl transition-all duration-300">
                          <UserCheck className="w-4 h-4 text-zinc-600 hover:text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="p-5 bg-zinc-950/80 border-t border-zinc-900/50">
                  <div className="flex gap-3">
                    <button className="flex-1 bg-zinc-900/50 border border-zinc-800/50 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white hover:border-zinc-700 transition-all">Manual Override</button>
                    <button className="flex-1 bg-zinc-900/50 border border-zinc-800/50 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white hover:border-zinc-700 transition-all">Issue Guest</button>
                  </div>
               </div>
            </Card>

            <Card className="p-8 bg-gradient-to-br from-zinc-950 to-zinc-900/20 border-[var(--gym-brand)]/5 hover:border-[var(--gym-brand)]/10 transition-all duration-700">
              <div className="flex items-center gap-3 mb-8">
                <TrendingUp className="w-4 h-4 text-[var(--gym-brand)]/70" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Peak Forecast</h3>
              </div>
              <div className="flex items-end justify-between h-24 gap-1.5 mb-6 group/chart">
                {[30, 45, 60, 85, 100, 75, 50, 40, 60, 90, 80, 45].map((h, i) => (
                  <div 
                    key={i} 
                    style={{ height: h + "%" }} 
                    className={"flex-1 rounded-t-lg transition-all duration-1000 " + (h > 80 ? 'bg-rose-500/30' : 'bg-[var(--gym-brand)]/10 group-hover/chart:bg-[var(--gym-brand)]/20')} 
                  />
                ))}
              </div>
              <div className="bg-[var(--gym-brand-glow)] border border-[var(--gym-brand)]/10 rounded-full py-2 px-4">
                <p className="text-[9px] text-[var(--gym-brand)] text-center font-black uppercase tracking-[0.2em]">Expected Peak: 17:00 - 19:00</p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
