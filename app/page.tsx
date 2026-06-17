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
  zinc: { primary: "#71717a", glow: "rgba(113, 113, 122, 0.2)" },
  emerald: { primary: "#10b981", glow: "rgba(16, 185, 129, 0.2)" },
  indigo: { primary: "#6366f1", glow: "rgba(99, 102, 241, 0.2)" },
  amber: { primary: "#f59e0b", glow: "rgba(245, 158, 11, 0.2)" },
  rose: { primary: "#f43f5e", glow: "rgba(244, 63, 94, 0.2)" },
};

const Card = ({ children, className = "", style = {} }: { children: React.ReactNode, className?: string, style?: any }) => (
  <div 
    style={style}
    className={"bg-zinc-900/50 border border-zinc-800 backdrop-blur-md rounded-xl p-5 hover:border-zinc-700/50 transition-all duration-300 shadow-sm " + className}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "warning" | "danger" | "success" | "brand" }) => {
  const styles = {
    default: "bg-zinc-800 text-zinc-400",
    warning: "bg-amber-500/10 text-amber-500",
    danger: "bg-red-500/10 text-red-500",
    success: "bg-emerald-500/10 text-emerald-500",
    brand: "bg-[var(--gym-brand-glow)] text-[var(--gym-brand)] border border-[var(--gym-brand)]/20",
  };
  return (
    <span className={"text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tight " + styles[variant as keyof typeof styles]}>
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

  if (!mounted) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 pb-20" style={brandStyles}>
      <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-[var(--gym-brand)] flex items-center justify-center shadow-[0_0_15px_var(--gym-brand-glow)]">
                 <Zap className="w-5 h-5 text-black fill-black" />
               </div>
               <span className="text-xl font-bold tracking-tighter text-white">GymOS</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-xs font-medium uppercase tracking-widest text-zinc-500">
              <a href="#" className="text-[var(--gym-brand)]">Overview</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Members</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Staff</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Settings</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-500 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--gym-brand)] rounded-full border-2 border-black" />
            </button>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">GY</div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-6 py-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-white mb-2">Iron Sanctuary</h1>
            <p className="text-zinc-500 text-sm flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              System Online — Facilitating Peak Performance
            </p>
          </div>
          <div className="flex gap-3">
            <button className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
              Reports
            </button>
            <button className="bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              <Plus className="w-4 h-4" /> New Member
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Gym Vitals</h3>
            <div className="grid gap-4">
                {[
                  { label: "Members", value: "1,284", icon: Users, color: "text-blue-400" },
                  { label: "Check-ins", value: "42", icon: Activity, color: "text-emerald-400" },
                  { label: "Revenue", value: "$42.8k", icon: DollarSign, color: "text-white" },
                  { label: "At-Risk", value: "12", icon: AlertTriangle, color: "text-amber-400" },
                ].map((stat) => (
                  <Card key={stat.label} className="group cursor-default py-4">
                    <div className="flex items-center gap-4">
                      <div className={"p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700 transition-colors " + stat.color}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
                        <p className="text-xl font-bold text-white tracking-tight">{stat.value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>

            <Card className="mt-8 border-[var(--gym-brand)]/20 bg-gradient-to-b from-zinc-900/80 to-zinc-950">
              <div className="flex items-center gap-2 mb-6">
                <Palette className="w-4 h-4 text-[var(--gym-brand)]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Brand Customizer</h3>
              </div>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed">Select a theme to see the dashboard accent colors update in real-time.</p>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(BRAND_CONFIGS) as BrandColor[]).map((c) => (
                  <button 
                    key={c}
                    onClick={() => setBrand(c)}
                    className={"h-10 rounded-lg border-2 transition-all " + (brand === c ? 'border-white scale-110' : 'border-transparent hover:scale-105')}
                    style={{ backgroundColor: BRAND_CONFIGS[c].primary }}
                    title={c}
                  />
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Brand Mode</span>
                    <Badge variant="brand">{brand}</Badge>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Autonomous Operations</h3>
            <Card className="p-0 overflow-hidden group">
               <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/30">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <ShieldCheck className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Churn Shield</h4>
                      <p className="text-[10px] text-zinc-500 font-medium">Predictive Retention Agent</p>
                    </div>
                 </div>
                 <Badge variant="brand">Running</Badge>
               </div>
               <div className="divide-y divide-zinc-800/50">
                  {[
                    { name: "Marcus Wright", plan: "Pro", score: 88, status: "Active" },
                    { name: "Elena Rodriguez", plan: "Basic", score: 32, status: "At Risk" },
                    { name: "Sarah Chen", plan: "Pro", score: 94, status: "Active" },
                  ].map((m, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-[var(--gym-brand-glow)] transition-all cursor-pointer group/row">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 group-hover/row:border-[var(--gym-brand)] border border-transparent transition-all">
                            {m.name[0]}
                           </div>
                           <div>
                             <p className="text-xs font-bold text-zinc-200">{m.name}</p>
                             <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{m.plan} Membership</p>
                           </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-zinc-500 font-bold uppercase">Score</p>
                          <p className={"text-xs font-black " + (m.score > 70 ? 'text-emerald-500' : 'text-amber-500')}>{m.score}%</p>
                        </div>
                    </div>
                  ))}
               </div>
               <div className="p-3 bg-zinc-950/50 text-center">
                 <button className="text-[9px] font-bold text-zinc-500 hover:text-[var(--gym-brand)] transition-colors uppercase tracking-[0.2em]">View All Insights</button>
               </div>
            </Card>

            <Card className="p-0 overflow-hidden border-amber-500/10">
               <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/30">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <Wrench className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Maintenance Oracle</h4>
                      <p className="text-[10px] text-zinc-500 font-medium">IoT Equipment Monitoring</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-[10px] font-black text-amber-500 uppercase">2 Alerts</span>
                 </div>
               </div>
               <div className="p-5 space-y-4">
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-zinc-200">Treadmill #4 - Motor Heat</p>
                      <p className="text-[10px] text-zinc-500 mt-1">High probability of failure within 72 hours.</p>
                    </div>
                    <button className="p-1.5 hover:bg-amber-500/20 rounded-md transition-colors text-amber-500">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start justify-between opacity-60">
                    <div>
                      <p className="text-xs font-bold text-zinc-400">Rowing Machine B - Chain Tension</p>
                      <p className="text-[10px] text-zinc-600 mt-1">Routine maintenance recommended next week.</p>
                    </div>
                    <Info className="w-4 h-4 text-zinc-700" />
                  </div>
               </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Reception Scanner</h3>
            <Card className="p-0 overflow-hidden border-[var(--gym-brand)]/10">
               <div className="p-8 bg-zinc-950 flex flex-col items-center justify-center border-b border-zinc-800 relative group cursor-pointer">
                  <div className="absolute inset-0 bg-[var(--gym-brand-glow)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="absolute -inset-4 bg-[var(--gym-brand-glow)] rounded-full blur-2xl animate-pulse" />
                    <ScanLine className="w-16 h-16 text-[var(--gym-brand)] relative z-10" />
                  </div>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-zinc-400 group-hover:text-white transition-colors relative z-10">Scan Member Card</p>
                  <p className="mt-2 text-[10px] text-zinc-600 font-medium relative z-10">Waiting for check-in...</p>
               </div>
               
               <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Entry Log</h5>
                    <div className="flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                       <span className="text-[9px] font-bold text-zinc-400 uppercase">Live</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { name: "John Wick", time: "08:12 AM", type: "Member", status: "Success" },
                      { name: "Tyler Durden", time: "07:55 AM", time: "07:55 AM", type: "Guest", status: "Success" },
                      { name: "Sarah Connor", time: "07:42 AM", type: "Member", status: "Warning" },
                    ].map((log, i) => (
                      <div key={i} className="flex items-center justify-between group/log">
                        <div className="flex items-center gap-3">
                           <div className={"w-1 h-8 rounded-full " + (log.status === 'Success' ? 'bg-emerald-500' : 'bg-amber-500')} />
                           <div>
                             <p className="text-xs font-bold text-zinc-200">{log.name}</p>
                             <p className="text-[10px] text-zinc-500">{log.time} • {log.type}</p>
                           </div>
                        </div>
                        <button className="opacity-0 group-hover/log:opacity-100 p-2 hover:bg-zinc-800 rounded-lg transition-all">
                          <UserCheck className="w-4 h-4 text-zinc-400 hover:text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="p-5 bg-zinc-950/50 border-t border-zinc-800">
                  <div className="flex gap-2">
                    <button className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-zinc-700 transition-all">Manual Entry</button>
                    <button className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-zinc-700 transition-all">Guest Pass</button>
                  </div>
               </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border-emerald-500/10">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Peak Hours Forecast</h3>
              </div>
              <div className="flex items-end justify-between h-20 gap-1 mb-4">
                {[30, 45, 60, 85, 100, 75, 50, 40, 60, 90, 80, 45].map((h, i) => (
                  <div 
                    key={i} 
                    style={{ height: h + "%" }} 
                    className={"flex-1 rounded-t-sm transition-all duration-500 " + (h > 80 ? 'bg-rose-500/50' : 'bg-emerald-500/20 group-hover:bg-emerald-500/40')} 
                  />
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 text-center font-medium uppercase tracking-widest">Expected Peak: 5:00 PM - 7:00 PM</p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}