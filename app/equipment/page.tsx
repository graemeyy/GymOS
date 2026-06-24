"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap,
  ArrowLeft,
  Wrench,
  Activity,
  AlertCircle,
  CheckCircle2,
  Settings,
  History,
  Timer
} from "lucide-react";

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-slate-900 rounded-none p-6 " + className}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "success" | "warning" | "danger" }) => {
  const styles = {
    default: "bg-white text-slate-900 border-slate-900",
    success: "bg-blue-600 text-white border-blue-600",
    warning: "bg-amber-500 text-white border-amber-500",
    danger: "bg-rose-600 text-white border-rose-600",
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 border-2 uppercase tracking-widest ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default function EquipmentPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

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
              <a href="/" className="text-slate-400 hover:text-slate-900">Command</a>
              <a href="/members" className="text-slate-400 hover:text-slate-900">Members</a>
              <a href="/equipment" className="text-blue-600 border-b-2 border-blue-600 pb-1">Hardware</a>
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Asset Management</span>
            </div>
            <h1 className="text-7xl font-black tracking-tight uppercase leading-none mb-4">Hardware</h1>
            <p className="text-slate-900 text-lg font-black uppercase tracking-widest">Maintenance & Wear Matrix</p>
          </div>
          <div className="flex gap-4">
            <button className="bg-slate-900 text-white border-2 border-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-blue-600 transition-all">
              <Settings className="w-4 h-4" /> System Audit
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="md:col-span-2 space-y-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">Inventory Status</h3>
            <div className="grid grid-cols-1 gap-6">
              {[
                { name: "Power Rack Node-01", status: "Operational", health: 98, lastService: "2 Days Ago" },
                { name: "Treadmill Array-B", status: "Warning", health: 64, lastService: "45 Days Ago" },
                { name: "Cable Crossover S-02", status: "Operational", health: 88, lastService: "12 Days Ago" },
                { name: "Dumbbell Cluster 5-50", status: "Operational", health: 100, lastService: "Never" },
              ].map((eq, i) => (
                <Card key={i} className="hover:bg-blue-50 transition-colors border-2 border-slate-900">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="p-4 bg-slate-50 border-2 border-slate-900">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tight">{eq.name}</h4>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Service: {eq.lastService}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit Health</p>
                        <p className="text-xl font-black">{eq.health}%</p>
                      </div>
                      <Badge variant={eq.status === 'Operational' ? 'success' : 'warning'}>{eq.status}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">Maintenance Queue</h3>
            <Card className="border-4 border-slate-900 bg-slate-50">
              <div className="flex items-center gap-3 mb-6 text-rose-600">
                <AlertCircle className="w-6 h-6" />
                <h4 className="text-xs font-black uppercase tracking-widest">Priority Actions</h4>
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-white border-2 border-slate-900">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Asset-492</p>
                  <p className="text-xs font-black uppercase mb-3">Treadmill B Belt Replacement</p>
                  <button className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">Authorize Repair</button>
                </div>
                <div className="p-4 bg-white border-2 border-slate-900">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Asset-102</p>
                  <p className="text-xs font-black uppercase mb-3">Rack 01 Bolt Tightening</p>
                  <button className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">Mark Resolved</button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
