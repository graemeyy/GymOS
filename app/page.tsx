"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Activity, 
  DollarSign, 
  AlertTriangle, 
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
  TrendingDown
} from "lucide-react";

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-blue-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 " + className}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "warning" | "danger" | "success" | "brand" }) => {
  const styles = {
    default: "bg-slate-100 text-slate-600 border border-slate-200",
    warning: "bg-blue-50 text-blue-600 border border-blue-200",
    danger: "bg-rose-50 text-rose-600 border border-rose-200",
    success: "bg-blue-100 text-blue-700 border border-blue-200",
    brand: "bg-blue-600 text-white border border-blue-700",
  };
  return (
    <span className={"text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest " + styles[variant]}>
      {children}
    </span>
  );
};

const MetricCard = ({ label, value, change, icon: Icon, trend = "up" }: any) => (
  <Card className="group cursor-default relative overflow-hidden">
    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
    <div className="flex justify-between items-start mb-6">
      <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-5 h-5" />
      </div>
      <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border ${trend === 'up' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {change}
      </div>
    </div>
    <div>
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  </Card>
);

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  
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

  const handleAction = (name: string) => {
    setNotification({ message: `${name} successful.`, type: 'info' });
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
        setNotification({ message: "Member enrolled.", type: 'success' });
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
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 pb-20">
      
      {/* Notifications */}
      {notification && (
        <div className="fixed top-24 right-8 z-[100] animate-in slide-in-from-right fade-in duration-500">
          <div className="px-6 py-4 rounded-2xl border-2 border-blue-100 bg-white shadow-2xl flex items-center gap-4 text-blue-700">
            <div className="p-1.5 rounded-lg bg-blue-50">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">{notification.message}</span>
          </div>
        </div>
      )}

      {/* New Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setShowMemberModal(false)} />
          <Card className="w-full max-w-md relative animate-in zoom-in-95 duration-300 border-blue-200 shadow-2xl">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Member Enrollment</h2>
                <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Access provisioning system</p>
              </div>
              <button onClick={() => setShowMemberModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitMember} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Legal Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                  placeholder="e.g. Jax Teller"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Email Connection</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                  placeholder="jax@reaper.com"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">System Tier</label>
                <div className="relative">
                  <select 
                    value={formData.plan}
                    onChange={(e) => setFormData({...formData, plan: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 focus:bg-white focus:outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="BASIC">Standard Entry</option>
                    <option value="PREMIUM">Premium Access</option>
                    <option value="PLATINUM">Platinum Elite</option>
                  </select>
                  <ChevronRight className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Authorize Access <ChevronRight className="w-4 h-4" /></>}
              </button>
            </form>
          </Card>
        </div>
      )}

      <nav className="border-b-2 border-blue-50 bg-white/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3 group cursor-pointer">
               <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-100 group-hover:rotate-6 transition-all duration-500">
                 <Zap className="w-5 h-5 text-white fill-white" />
               </div>
               <span className="text-2xl font-black tracking-tighter text-slate-900">GymOS</span>
            </div>
            <div className="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
              <a href="#" className="text-blue-600 border-b-2 border-blue-600 pb-1">Command</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Intelligence</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Operations</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Configurations</a>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all relative group">
                <Bell className="w-5 h-5" />
                <span className="absolute top-3.5 right-3.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l-2 border-blue-50">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Graeme York</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">System Admin</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-black text-blue-600 hover:scale-105 transition-all cursor-pointer">GY</div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-8 py-16">
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-10 mb-20">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="brand">Protocol 4.0 Active</Badge>
              <div className="h-px w-12 bg-blue-100" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Iron Sanctuary</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tight text-slate-900 mb-6 leading-none">Operations Center</h1>
            <p className="text-slate-500 text-base md:text-lg flex items-center gap-4 font-bold">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              Neural Network Online <span className="text-slate-300">|</span> 1,284 Active Nodes Managed
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => handleAction("System Diagnostics")}
              className="bg-white border-2 border-slate-100 hover:border-blue-200 text-slate-600 hover:text-blue-600 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-sm"
            >
              Intelligence
            </button>
            <button 
              onClick={() => setShowMemberModal(true)}
              className="bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-all shadow-xl shadow-blue-100"
            >
              <Plus className="w-5 h-5" /> Enroll Node
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-12 xl:col-span-3 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6">
                <MetricCard 
                  label="Network Revenue" 
                  value="$42,850" 
                  change="+12.5%" 
                  icon={DollarSign} 
                  trend="up"
                />
                <MetricCard 
                  label="Active Nodes" 
                  value="1,284" 
                  change="+4.2%" 
                  icon={Users} 
                  trend="up"
                />
                <MetricCard 
                  label="Daily Entry" 
                  value="142" 
                  change="-2.1%" 
                  icon={Activity} 
                  trend="down"
                />
                <MetricCard 
                  label="Critical Alerts" 
                  value="02" 
                  change="+1" 
                  icon={AlertTriangle} 
                  trend="up"
                />
            </div>
          </div>

          <div className="lg:col-span-7 xl:col-span-5 space-y-10">
            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Predictive Retention</h3>
                <Badge variant="success">Shield Active</Badge>
              </div>
              <Card className="p-0 overflow-hidden border-blue-100 shadow-xl shadow-slate-100/50">
                 <div className="divide-y-2 divide-blue-50">
                    {[
                      { name: "Marcus Wright", plan: "Elite", score: 92, trend: "up" },
                      { name: "Elena Rodriguez", plan: "Standard", score: 32, trend: "down" },
                      { name: "Sarah Chen", plan: "Elite", score: 88, trend: "up" },
                      { name: "Tyler Durden", plan: "Trial", score: 15, trend: "down" },
                    ].map((m, i) => (
                      <div key={i} className="p-6 flex items-center justify-between hover:bg-blue-50 transition-all duration-300 group cursor-pointer">
                          <div className="flex items-center gap-5">
                             <div className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center text-xs font-black text-slate-400 group-hover:border-blue-200 group-hover:text-blue-600 transition-all">
                              {m.name[0]}
                             </div>
                             <div>
                               <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{m.name}</p>
                               <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{m.plan} Protocol</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Score</p>
                              <p className={`text-base font-black tracking-tighter ${m.score > 50 ? 'text-blue-600' : 'text-slate-400'}`}>{m.score}%</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                          </div>
                      </div>
                    ))}
                 </div>
                 <button onClick={() => handleAction("Deep Insight Pull")} className="w-full py-5 bg-slate-50 text-[10px] font-black text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-[0.4em] border-t-2 border-blue-50">Access Retention Matrix</button>
              </Card>
            </section>

            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Node Maintenance</h3>
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500" />
                   <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">2 Critical</span>
                </div>
              </div>
              <div className="space-y-6">
                <Card className="p-0 border-blue-200 shadow-xl shadow-blue-50 group hover:border-blue-300">
                  <div className="p-6 flex items-start justify-between">
                    <div className="flex gap-5">
                      <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 h-fit border border-blue-100">
                        <Wrench className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900 tracking-tight">Treadmill #04 Core Failure</h4>
                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">Thermal Critical State</p>
                        <p className="text-xs text-slate-500 mt-4 leading-relaxed font-bold">Internal telemetry reports high friction in drive motor. Automating service dispatch...</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 border-t-2 border-blue-100">
                    <button onClick={() => handleAction("Service Ticket #429")} className="w-full py-3 bg-white border-2 border-blue-200 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] hover:bg-blue-100 hover:border-blue-400 transition-all shadow-sm">Authorize Intervention</button>
                  </div>
                </Card>
                
                <Card className="flex items-center justify-between group hover:border-blue-200 shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all border border-slate-100">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Rowing Node B Tension</h4>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Scheduled Care: 48h</p>
                    </div>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </Card>
              </div>
            </section>
          </div>

          <div className="lg:col-span-5 xl:col-span-4 space-y-10">
            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Scanner Node</h3>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                   <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Online</span>
                </div>
              </div>
              <Card className="p-0 overflow-hidden border-2 border-blue-200 shadow-2xl shadow-blue-50">
                 <div 
                  onClick={() => handleAction("Biometric Calibration")}
                  className="p-16 bg-blue-600 flex flex-col items-center justify-center relative group cursor-pointer overflow-hidden"
                 >
                    <div className="relative">
                      <div className="absolute -inset-10 bg-white/20 rounded-full blur-[40px] animate-pulse" />
                      <ScanLine className="w-24 h-24 text-white relative z-10 group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <p className="mt-10 text-[10px] font-black uppercase tracking-[0.5em] text-white transition-colors relative z-10">Initialize Sync</p>
                    <p className="mt-3 text-[9px] text-blue-200 font-black uppercase tracking-widest relative z-10">Scan Ready</p>
                 </div>
                 
                 <div className="p-8">
                    <div className="space-y-8">
                      {[
                        { name: "John Wick", time: "08:12 AM", status: "success" },
                        { name: "Sarah Connor", time: "07:42 AM", status: "warning" },
                        { name: "Ellen Ripley", time: "07:15 AM", status: "success" },
                      ].map((log, i) => (
                        <div key={i} className="flex items-center justify-between group/log">
                          <div className="flex items-center gap-4">
                             <div className={`w-1.5 h-10 rounded-full ${log.status === 'success' ? 'bg-blue-600' : 'bg-slate-300'}`} />
                             <div>
                               <p className="text-sm font-black text-slate-900 group-hover/log:text-blue-600 transition-colors">{log.name}</p>
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">{log.time}</p>
                             </div>
                          </div>
                          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all opacity-0 group-hover/log:opacity-100">
                            <UserCheck className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-10 flex gap-4">
                      <button onClick={() => handleAction("Manual Override")} className="flex-1 bg-white border-2 border-slate-100 py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all">Manual</button>
                      <button onClick={() => handleAction("Guest Issue")} className="flex-1 bg-white border-2 border-slate-100 py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all">Guest</button>
                    </div>
                 </div>
              </Card>
            </section>

            <Card className="p-8 bg-white border-2 border-blue-100 shadow-xl shadow-slate-100/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Peak Intelligence</h3>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-end justify-between h-32 gap-2 mb-8 group/chart">
                {[30, 45, 60, 85, 100, 75, 50, 40, 60, 90, 80, 45].map((h, i) => (
                  <div 
                    key={i} 
                    style={{ height: h + "%" }} 
                    className={`flex-1 rounded-t-xl transition-all duration-1000 bg-blue-100 group-hover/chart:bg-blue-600 group-hover/chart:shadow-lg group-hover/chart:shadow-blue-100`} 
                  />
                ))}
              </div>
              <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl py-4 px-6 text-center">
                <p className="text-[10px] text-blue-700 font-black uppercase tracking-[0.3em]">Expected Peak: 17:00 - 19:00</p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
