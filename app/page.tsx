"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  DollarSign, 
  Plus, 
  TrendingUp, 
  Bell,
  Search,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  UserPlus,
  LayoutDashboard,
  Settings,
  CreditCard,
  MessageSquare,
  Palette,
  Zap,
  Activity
} from "lucide-react";

// --- Theme Configuration ---
type BrandColor = "emerald" | "indigo" | "amber" | "rose" | "zinc";

const BRAND_CONFIGS = {
  emerald: { primary: "#10b981", glow: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.3)" },
  indigo: { primary: "#6366f1", glow: "rgba(99, 102, 241, 0.15)", border: "rgba(99, 102, 241, 0.3)" },
  amber: { primary: "#f59e0b", glow: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)" },
  rose: { primary: "#f43f5e", glow: "rgba(244, 63, 94, 0.15)", border: "rgba(244, 63, 94, 0.3)" },
  zinc: { primary: "#71717a", glow: "rgba(113, 113, 122, 0.15)", border: "rgba(113, 113, 122, 0.3)" },
};

// --- Custom UI Primitives (Dynamic) ---
const Card = ({ children, className = "", hoverGlow = false }: { children: React.ReactNode, className?: string, hoverGlow?: boolean }) => (
  <div className={`bg-zinc-950/80 border border-zinc-900 rounded-xl backdrop-blur-md transition-all duration-500 ${hoverGlow ? 'hover:border-[var(--brand-border)] hover:shadow-[0_0_20px_var(--brand-glow)]' : ''} ${className}`}>
    {children}
  </div>
);

const Button = ({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: "brand" | "outline" | "ghost" | "secondary", className?: string }) => {
  const base = "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-95";
  const variants = {
    brand: "bg-[var(--brand-color)] text-black hover:brightness-110 shadow-[0_0_15px_var(--brand-glow)]",
    outline: "bg-transparent border border-zinc-800 text-zinc-300 hover:border-[var(--brand-border)] hover:text-white",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900",
    secondary: "bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-800"
  };
  return <button className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};

const Badge = ({ children, variant = "brand" }: { children: React.ReactNode, variant?: "brand" | "warning" | "success" }) => {
  const styles = {
    brand: "bg-[var(--brand-glow)] text-[var(--brand-color)] border border-[var(--brand-border)]",
    warning: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  };
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${styles[variant]}`}>
      {children}
    </span>
  );
};

const MetricCard = ({ label, value, change, icon: Icon }: any) => (
  <Card className="p-6 group cursor-default" hoverGlow>
    <div className="flex justify-between items-start mb-4">
      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-[var(--brand-border)] transition-colors">
        <Icon className="w-5 h-5 text-[var(--brand-color)] transition-all duration-500 group-hover:scale-110" />
      </div>
      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
        <TrendingUp className="w-3 h-3" />
        {change}
      </div>
    </div>
    <div>
      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.1em] mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tracking-tighter">{value}</p>
    </div>
  </Card>
);

export default function DashboardRedesign() {
  const [brand, setBrand] = useState<BrandColor>("emerald");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-black" />;

  const currentTheme = BRAND_CONFIGS[brand];
  const brandStyles = {
    "--brand-color": currentTheme.primary,
    "--brand-glow": currentTheme.glow,
    "--brand-border": currentTheme.border,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-[var(--brand-color)] selection:text-black flex" style={brandStyles}>
      
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-zinc-900 flex-col p-6 space-y-8 bg-zinc-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-color)] flex items-center justify-center shadow-[0_0_20px_var(--brand-glow)] transition-all duration-500">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="text-xl font-black tracking-tighter text-white">GymOS</span>
        </div>

        <nav className="space-y-1">
          <Button variant="secondary" className="w-full justify-start gap-3 px-3 border-[var(--brand-border)] bg-zinc-900/50">
            <LayoutDashboard className="w-4 h-4 text-[var(--brand-color)]" /> Dashboard
          </Button>
          {[
            { icon: Users, label: "Members" },
            { icon: Calendar, label: "Classes" },
            { icon: MessageSquare, label: "Leads" },
            { icon: CreditCard, label: "Billing" },
            { icon: Settings, label: "Settings" }
          ].map((item) => (
            <Button key={item.label} variant="ghost" className="w-full justify-start gap-3 px-3">
              <item.icon className="w-4 h-4" /> {item.label}
            </Button>
          ))}
        </nav>

        {/* Theme Picker in Sidebar */}
        <div className="pt-8 border-t border-zinc-900">
           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-4">Brand Accent</p>
           <div className="grid grid-cols-5 gap-2 px-2">
             {(Object.keys(BRAND_CONFIGS) as BrandColor[]).map((c) => (
               <button 
                key={c}
                onClick={() => setBrand(c)}
                className={`h-8 rounded-md border-2 transition-all ${brand === c ? 'border-white scale-110 shadow-[0_0_10px_white/20]' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: BRAND_CONFIGS[c].primary }}
               />
             ))}
           </div>
        </div>

        <div className="mt-auto pt-6 border-t border-zinc-900">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 group cursor-pointer hover:border-[var(--brand-border)] transition-colors">GY</div>
            <div>
              <p className="text-xs font-bold text-white">Graeme York</p>
              <p className="text-[10px] text-zinc-500 font-medium">Head of Operations</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 lg:px-10 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search command center..." 
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--brand-border)] focus:shadow-[0_0_10px_var(--brand-glow)] transition-all duration-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-500 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--brand-color)] rounded-full border-2 border-black animate-pulse" />
            </button>
            <Button variant="brand" className="px-4 h-10">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Member</span>
            </Button>
          </div>
        </header>

        <main className="p-6 lg:p-10 space-y-8 overflow-y-auto custom-scrollbar">
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <MetricCard label="Total Revenue" value="$24,530" change="+12.5%" icon={DollarSign} />
            <MetricCard label="Active Members" value="428" change="+4.2%" icon={Users} />
            <MetricCard label="New Leads" value="64" change="+18.7%" icon={UserPlus} />
            <MetricCard label="Check-ins" value="1,246" change="+2.4%" icon={Activity} />
          </section>

          <section>
            <Card className="p-8 border-[var(--brand-border)]/10" hoverGlow>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tighter">Performance Matrix</h3>
                  <p className="text-xs text-zinc-500 font-medium">Real-time attendance and revenue scalability.</p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                   <button className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-[var(--brand-color)] text-black rounded-lg shadow-[0_0_10px_var(--brand-glow)]">Revenue</button>
                   <button className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Retention</button>
                </div>
              </div>
              
              <div className="h-[300px] w-full flex items-end justify-between gap-3 px-2 relative group/chart">
                <div className="absolute inset-0 grid grid-rows-4 pointer-events-none opacity-20">
                  {[...Array(4)].map((_, i) => <div key={i} className="border-t border-zinc-800 w-full" />)}
                </div>
                {[45, 52, 48, 61, 72, 68, 85, 78, 92, 88, 95, 100].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-4 group relative z-10">
                    <div 
                      className="w-full bg-zinc-900 rounded-t-md relative overflow-hidden group-hover:bg-[var(--brand-glow)] group-hover:border-t-2 group-hover:border-[var(--brand-color)] transition-all duration-500 cursor-pointer" 
                      style={{ height: `${val}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[var(--brand-color)] opacity-0 group-hover:opacity-20 transition-opacity" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter transition-colors group-hover:text-zinc-300">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Recent Deployments</h3>
                <Button variant="ghost" className="text-[10px] p-0 h-auto uppercase tracking-tighter font-black">Archive</Button>
              </div>
              <Card className="overflow-hidden border-zinc-900/50">
                <div className="divide-y divide-zinc-900/50">
                  {[
                    { name: "Alex Rivera", class: "HIIT Training", time: "09:00 AM", status: "Success" },
                    { name: "Sarah Chen", class: "Yoga Flow", time: "10:30 AM", status: "Success" },
                    { name: "James Wilson", class: "Strength Lab", time: "05:00 PM", status: "Warning" },
                    { name: "Emma Thompson", class: "HIIT Training", time: "06:30 PM", status: "Success" },
                  ].map((booking, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-[var(--brand-glow)] transition-all duration-300 group cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-black text-zinc-500 group-hover:border-[var(--brand-border)] group-hover:text-[var(--brand-color)] transition-all">
                          {booking.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-[var(--brand-color)] transition-colors">{booking.name}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{booking.class}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-bold text-white">{booking.time}</p>
                          <Badge variant={booking.status === 'Warning' ? 'warning' : 'brand'}>{booking.status}</Badge>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Member Retention Leads</h3>
                <Button variant="ghost" className="text-[10px] p-0 h-auto uppercase tracking-tighter font-black">Full CRM</Button>
              </div>
              <Card className="overflow-hidden border-zinc-900/50">
                <div className="divide-y divide-zinc-900/50">
                  {[
                    { name: "Marcus Wright", source: "Instagram", date: "Today", score: 92 },
                    { name: "Elena Rodriguez", source: "Website", date: "Yesterday", score: 85 },
                    { name: "Chris Bacon", source: "Referral", date: "2 days ago", score: 78 },
                    { name: "John Wick", source: "Direct", date: "3 days ago", score: 95 },
                  ].map((lead, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-[var(--brand-glow)] transition-all duration-300 group cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-black text-zinc-500 group-hover:border-[var(--brand-border)] group-hover:text-[var(--brand-color)] transition-all">
                          {lead.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-[var(--brand-color)] transition-colors">{lead.name}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{lead.source} • {lead.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 group-hover:border-[var(--brand-border)] transition-colors">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Score</span>
                          <span className="text-xs font-black text-[var(--brand-color)]">{lead.score}</span>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-zinc-800 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
