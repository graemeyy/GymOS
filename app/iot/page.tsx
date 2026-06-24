"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap,
  ArrowLeft,
  Scan,
  Monitor,
  Activity,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Terminal,
  Server
} from "lucide-react";

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-slate-900 rounded-none p-6 " + className}>
    {children}
  </div>
);

const Badge = ({ children, variant = "active" }: { children: React.ReactNode, variant?: "active" | "idle" }) => {
  return (
    <span className={`text-[10px] font-black px-3 py-1 border-2 uppercase tracking-widest ${variant === 'active' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
      {children}
    </span>
  );
};

export default function IOTPage() {
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
              <a href="/iot" className="text-blue-600 border-b-2 border-blue-600 pb-1">Gateways</a>
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Peripheral Sync</span>
            </div>
            <h1 className="text-7xl font-black tracking-tight uppercase leading-none mb-4">IoT Gateways</h1>
            <p className="text-slate-900 text-lg font-black uppercase tracking-widest">Entry Controller & Hardware Sync</p>
          </div>
          <div className="flex gap-4">
            <button className="bg-slate-900 text-white border-2 border-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-blue-600 transition-all">
              <RefreshCw className="w-4 h-4" /> Reset Controller
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">Live Access Stream</h3>
            <Card className="bg-slate-900 border-4 border-slate-900 font-mono text-blue-400 p-8">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                <Terminal className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Gateway Monitor v2.1</span>
              </div>
              <div className="space-y-3 text-xs">
                <p><span className="text-slate-500">[08:42:11]</span> AUTH_SUCCESS: Member-0492 (Marcus Wright)</p>
                <p><span className="text-slate-500">[08:45:32]</span> GATE_OPEN: Controller-01 (Main Entry)</p>
                <p><span className="text-slate-500">[08:52:01]</span> SCAN_EVENT: Barcode-910293</p>
                <p className="text-rose-500"><span className="text-slate-500">[08:52:01]</span> AUTH_FAILURE: Expired Subscription (Elena R.)</p>
                <p><span className="text-slate-500">[09:01:24]</span> HEARTBEAT: Controller-02 (Weight Room) OK</p>
                <p className="animate-pulse">_</p>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-2 border-slate-900">
                <div className="flex justify-between items-start mb-6">
                  <Cpu className="w-8 h-8 text-blue-600" />
                  <Badge>Active</Badge>
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight">Main Entry Controller</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Uptime: 142 Hours</p>
              </Card>
              <Card className="border-2 border-slate-900">
                <div className="flex justify-between items-start mb-6">
                  <Server className="w-8 h-8 text-slate-400" />
                  <Badge variant="idle">Idle</Badge>
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight">Secondary Gate-02</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Uptime: 0 Hours</p>
              </Card>
            </div>
          </div>

          <div className="space-y-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">API Configuration</h3>
            <Card className="border-2 border-slate-900">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Endpoint URL</p>
                  <div className="p-3 bg-slate-50 border-2 border-slate-900 text-[10px] font-mono break-all">
                    /api/iot/checkin
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Security Key</p>
                  <div className="p-3 bg-slate-50 border-2 border-slate-900 text-[10px] font-mono">
                    GYM_SEC_****************
                  </div>
                </div>
                <button className="w-full py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] border-2 border-slate-900 hover:bg-blue-700 transition-all">
                  Regenerate Token
                </button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
