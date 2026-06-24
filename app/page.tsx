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
  ScanLine,
  UserCheck, 
  Zap,
  Info,
  X,
  Loader2,
  ChevronRight,
  TrendingDown,
  LayoutDashboard,
  Box,
  Cpu,
  BarChart3,
  Calendar,
  Settings
} from "lucide-react";

// --- BRUTALIST UI PRIMITIVES ---
const BrutalCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white border-[3px] border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-6 rounded-none ${className}`}>
    {children}
  </div>
);

const BrutalButton = ({ children, variant = "primary", className = "", onClick }: any) => {
  const base = "border-[3px] border-slate-900 px-6 py-3 font-black uppercase tracking-tighter transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 rounded-none";
  const variants = {
    primary: "bg-[#0055ff] text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:bg-[#0044cc]",
    secondary: "bg-white text-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50",
    danger: "bg-white text-red-600 border-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] hover:bg-red-50"
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

const BrutalBadge = ({ children, variant = "blue" }: { children: React.ReactNode, variant?: "blue" | "white" }) => {
  const styles = {
    blue: "bg-[#0055ff] text-white border-2 border-slate-900",
    white: "bg-white text-slate-900 border-2 border-slate-900",
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 uppercase tracking-widest inline-block rounded-none ${styles[variant]}`}>
      {children}
    </span>
  );
};

// --- COMPONENTS ---

const DashboardTab = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
    <BrutalCard className="bg-[#0055ff] text-white">
      <div className="flex justify-between items-start mb-8">
        <DollarSign className="w-10 h-10" />
        <TrendingUp className="w-6 h-6" />
      </div>
      <p className="font-black uppercase tracking-widest text-xs opacity-80">Revenue</p>
      <h2 className="text-4xl font-black italic">$42.8K</h2>
    </BrutalCard>

    <BrutalCard>
      <div className="flex justify-between items-start mb-8 text-[#0055ff]">
        <Users className="w-10 h-10" />
        <Plus className="w-6 h-6" />
      </div>
      <p className="font-black uppercase tracking-widest text-xs text-slate-500">Active Nodes</p>
      <h2 className="text-4xl font-black italic text-slate-900">1,284</h2>
    </BrutalCard>

    <BrutalCard>
      <div className="flex justify-between items-start mb-8 text-[#0055ff]">
        <Activity className="w-10 h-10" />
        <TrendingDown className="w-6 h-6" />
      </div>
      <p className="font-black uppercase tracking-widest text-xs text-slate-500">Check-ins</p>
      <h2 className="text-4xl font-black italic text-slate-900">142</h2>
    </BrutalCard>

    <BrutalCard>
      <div className="flex justify-between items-start mb-8 text-[#0055ff]">
        <AlertTriangle className="w-10 h-10" />
        <span className="font-black text-xl">!</span>
      </div>
      <p className="font-black uppercase tracking-widest text-xs text-slate-500">Alerts</p>
      <h2 className="text-4xl font-black italic text-slate-900">02</h2>
    </BrutalCard>
  </div>
);

const ChurnShieldTab = () => (
  <div className="space-y-10">
    <BrutalCard className="border-l-[12px] border-l-[#0055ff]">
      <div className="flex items-center gap-4 mb-6">
        <ShieldCheck className="w-8 h-8 text-[#0055ff]" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Churn Shield Predictive Agent</h2>
      </div>
      <p className="text-slate-700 font-bold max-w-2xl mb-8">
        AUTONOMOUS RETENTION PROTOCOL ENGAGED. ANALYZING NODE BEHAVIOR PATTERNS TO PREVENT SUBSCRIPTION DROPOFF VIA AGENTIC PREDICTION.
      </p>
      <div className="border-[3px] border-slate-900">
        <div className="bg-slate-900 text-white p-4 font-black uppercase tracking-widest text-[10px] flex justify-between">
          <span>Target Node</span>
          <span>Risk Score</span>
          <span>Status</span>
        </div>
        {[
          { name: "MARCUS WRIGHT", score: "92%", status: "OPTIMAL" },
          { name: "ELENA RODRIGUEZ", score: "32%", status: "CRITICAL" },
          { name: "SARAH CHEN", score: "88%", status: "OPTIMAL" },
          { name: "TYLER DURDEN", score: "15%", status: "IMMINENT_LOSS" },
        ].map((node, i) => (
          <div key={i} className="p-4 border-t-[3px] border-slate-900 flex justify-between items-center font-black group hover:bg-[#0055ff] hover:text-white transition-colors cursor-pointer">
            <span className="italic">{node.name}</span>
            <span className="text-2xl tracking-tighter">{node.score}</span>
            <BrutalBadge variant={node.status === 'OPTIMAL' ? 'blue' : 'white'}>{node.status}</BrutalBadge>
          </div>
        ))}
      </div>
    </BrutalCard>
  </div>
);

const MaintenanceTab = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <BrutalCard className="bg-[#0055ff] text-white border-slate-900">
      <Wrench className="w-12 h-12 mb-6" />
      <h2 className="text-4xl font-black uppercase italic mb-4">Maintenance Oracle</h2>
      <p className="font-bold mb-8 opacity-90">IoT SENSORS DETECTING HARDWARE FATIGUE IN REAL-TIME. HARDWARE LIFECYCLE PREDICTION ACTIVE.</p>
      <div className="space-y-4">
        <div className="bg-white text-slate-900 p-6 border-[3px] border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center mb-4">
            <span className="font-black uppercase tracking-widest text-xs">Node #04: Treadmill</span>
            <BrutalBadge>Critical</BrutalBadge>
          </div>
          <p className="font-black text-xl italic mb-2 tracking-tighter">MOTOR THERMAL LIMIT REACHED</p>
          <div className="w-full h-4 bg-slate-200 border-2 border-slate-900 rounded-none overflow-hidden">
            <div className="h-full bg-red-600 w-[95%]" />
          </div>
        </div>
      </div>
    </BrutalCard>

    <BrutalCard>
      <Cpu className="w-12 h-12 mb-6 text-[#0055ff]" />
      <h2 className="text-4xl font-black uppercase italic mb-4">System Node Log</h2>
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-4 border-2 border-slate-900 font-black flex justify-between items-center">
            <span className="uppercase text-[10px] tracking-widest">Node_Sync_{i * 1234}</span>
            <span className="text-[#0055ff]">ONLINE</span>
          </div>
        ))}
      </div>
    </BrutalCard>
  </div>
);

export default function GymOSBrutalist() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const tabs = [
    { id: "dashboard", label: "Operations", icon: LayoutDashboard },
    { id: "churn", label: "Churn Shield", icon: ShieldCheck },
    { id: "maintenance", label: "IoT Oracle", icon: Wrench },
    { id: "nodes", label: "Node Access", icon: ScanLine },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-mono selection:bg-[#0055ff] selection:text-white p-4 md:p-8">
      
      {/* HEADER SECTION */}
      <header className="mb-12 border-b-[6px] border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-slate-900 flex items-center justify-center">
              <Zap className="w-8 h-8 text-[#0055ff] fill-[#0055ff]" />
            </div>
            <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter">GymOS</h1>
          </div>
          <p className="text-xl font-black uppercase tracking-tighter text-[#0055ff]">Iron Sanctuary Node Management System [v4.0.0]</p>
        </div>
        <div className="flex gap-4">
           <BrutalButton variant="secondary"><Bell className="w-5 h-5" /></BrutalButton>
           <BrutalButton>Enroll New Node</BrutalButton>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto">
        
        {/* TAB NAVIGATION */}
        <div className="flex flex-wrap gap-0 mb-12 border-[3px] border-slate-900 bg-slate-900">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[150px] py-4 px-6 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs transition-all border-r-[3px] border-slate-900 last:border-r-0 ${
                activeTab === tab.id 
                ? 'bg-[#0055ff] text-white italic' 
                : 'bg-white text-slate-900 hover:bg-[#0055ff]/10'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'churn' && <ChurnShieldTab />}
          {activeTab === 'maintenance' && <MaintenanceTab />}
          {activeTab === 'nodes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <BrutalCard className="lg:col-span-2">
                <h2 className="text-4xl font-black uppercase italic mb-8">Access Logistics</h2>
                <div className="space-y-4">
                  {[
                    { user: "JOHN WICK", time: "08:12:00", type: "MEMBER", status: "AUTHORIZED" },
                    { user: "SARAH CONNOR", time: "07:42:15", type: "MEMBER", status: "WARNING" },
                    { user: "ELLEN RIPLEY", time: "07:15:30", type: "OFFICER", status: "AUTHORIZED" },
                    { user: "TYLER DURDEN", time: "06:55:00", type: "GUEST", status: "DENIED" },
                  ].map((log, i) => (
                    <div key={i} className="flex justify-between items-center p-4 border-[3px] border-slate-900 font-black">
                      <div className="flex flex-col">
                        <span className="text-xl italic tracking-tighter">{log.user}</span>
                        <span className="text-[10px] tracking-[0.3em] text-[#0055ff]">{log.time} // {log.type}</span>
                      </div>
                      <BrutalBadge variant={log.status === 'DENIED' ? 'white' : 'blue'}>{log.status}</BrutalBadge>
                    </div>
                  ))}
                </div>
              </BrutalCard>
              <BrutalCard className="bg-slate-900 text-white flex flex-col items-center justify-center py-20 border-[#0055ff] border-[8px]">
                <ScanLine className="w-32 h-32 text-[#0055ff] mb-8 animate-pulse" />
                <h3 className="text-3xl font-black uppercase italic text-center leading-none mb-6">Initialize Biometric Sync</h3>
                <BrutalButton variant="secondary" className="w-full">Start Scanner</BrutalButton>
              </BrutalCard>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-20 border-t-[3px] border-slate-900 pt-8 flex justify-between items-center">
        <p className="font-black uppercase tracking-widest text-[10px]">© 2026 IRON SANCTUARY OPERATIONS // ALL NODES PROTECTED</p>
        <div className="flex gap-4">
          <div className="w-4 h-4 bg-[#0055ff] border-2 border-slate-900" />
          <div className="w-4 h-4 bg-white border-2 border-slate-900" />
          <div className="w-4 h-4 bg-slate-900 border-2 border-slate-900" />
        </div>
      </footer>
    </div>
  );
}
