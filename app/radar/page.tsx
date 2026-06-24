"use client";

import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  TrendingDown, 
  Users, 
  MessageSquare, 
  Zap,
  ArrowLeft,
  Activity,
  ShieldAlert,
  ChevronRight,
  Phone
} from "lucide-react";

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-slate-900 rounded-none p-6 " + className}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "danger" | "warning" }) => {
  const styles = {
    default: "bg-white text-slate-900 border-slate-900",
    danger: "bg-rose-600 text-white border-rose-600",
    warning: "bg-amber-500 text-white border-amber-500",
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 border-2 uppercase tracking-widest ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default function RiskRadarPage() {
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
              <a href="/radar" className="text-blue-600 border-b-2 border-blue-600 pb-1">Risk Radar</a>
              <a href="/equipment" className="text-slate-400 hover:text-slate-900">Hardware</a>
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Retention Intel</span>
            </div>
            <h1 className="text-7xl font-black tracking-tight uppercase leading-none mb-4">Risk Radar</h1>
            <p className="text-slate-900 text-lg font-black uppercase tracking-widest">Predictive Churn Detection</p>
          </div>
          <div className="flex gap-4">
            <button className="bg-rose-600 text-white border-2 border-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-rose-700 transition-all">
              <ShieldAlert className="w-4 h-4" /> Run Churn Analysis
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          <Card className="border-2 border-slate-900">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">High Risk</p>
            <p className="text-4xl font-black">12</p>
          </Card>
          <Card className="border-2 border-slate-900">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ghosting</p>
            <p className="text-4xl font-black">28</p>
          </Card>
          <Card className="border-2 border-slate-900">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Churn Probability</p>
            <p className="text-4xl font-black text-rose-600">14%</p>
          </Card>
          <Card className="border-2 border-slate-900">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">LTV at Risk</p>
            <p className="text-4xl font-black">$3.2k</p>
          </Card>
        </div>

        <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3 mb-10">Priority Intervention List</h3>
        <div className="space-y-6">
          {[
            { name: "Tyler Durden", lastSeen: "24 Days Ago", score: 15, status: "Critical" },
            { name: "Elena Rodriguez", lastSeen: "18 Days Ago", score: 32, status: "Warning" },
            { name: "Marcus Wright", lastSeen: "12 Days Ago", score: 48, status: "Warning" },
          ].map((r, i) => (
            <Card key={i} className="flex flex-col md:flex-row items-center justify-between gap-10 border-2 border-slate-900 hover:bg-blue-50 transition-colors">
              <div className="flex items-center gap-6 flex-1">
                <div className="w-16 h-16 bg-slate-100 border-2 border-slate-900 flex items-center justify-center font-black text-xl">
                  {r.name[0]}
                </div>
                <div>
                  <h4 className="text-xl font-black uppercase tracking-tight">{r.name}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Check-in: {r.lastSeen}</p>
                </div>
              </div>
              <div className="flex items-center gap-12">
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Risk Score</p>
                  <p className={`text-2xl font-black ${r.score < 20 ? 'text-rose-600' : 'text-amber-500'}`}>{r.score}%</p>
                </div>
                <Badge variant={r.status === 'Critical' ? 'danger' : 'warning'}>{r.status}</Badge>
                <button className="bg-slate-900 text-white p-4 border-2 border-slate-900 hover:bg-blue-600 transition-colors">
                  <Phone className="w-5 h-5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
