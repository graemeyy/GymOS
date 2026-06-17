"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Activity, 
  DollarSign, 
  Plus, 
  TrendingUp, 
  Bell,
  Search,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight,
  UserPlus,
  LayoutDashboard,
  Settings,
  CreditCard,
  MessageSquare
} from "lucide-react";

// --- Custom UI Primitives (Shadcn-like) ---
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-zinc-950 border border-zinc-900 rounded-xl ${className}`}>
    {children}
  </div>
);

const Button = ({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: "default" | "outline" | "ghost" | "secondary", className?: string }) => {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2";
  const variants = {
    default: "bg-white text-black hover:bg-zinc-200",
    outline: "bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-900",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900",
    secondary: "bg-zinc-900 text-white hover:bg-zinc-800"
  };
  return <button className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};

const MetricCard = ({ label, value, change, icon: Icon, color }: any) => (
  <Card className="p-6">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg bg-zinc-900 border border-zinc-800 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
        <TrendingUp className="w-3 h-3" />
        {change}
      </div>
    </div>
    <div>
      <p className="text-zinc-500 text-xs font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  </Card>
);

export default function DashboardRedesign() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 flex">
      
      {/* Sidebar - Desktop Only */}
      <aside className="hidden lg:flex w-64 border-r border-zinc-900 flex-col p-6 space-y-8 bg-zinc-950/50">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-black" />
          </div>
          <span className="text-lg font-bold tracking-tighter text-white">GymOS</span>
        </div>

        <nav className="space-y-1">
          <Button variant="secondary" className="w-full justify-start gap-3 px-3">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 px-3">
            <Users className="w-4 h-4" /> Members
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 px-3">
            <Calendar className="w-4 h-4" /> Classes
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 px-3">
            <MessageSquare className="w-4 h-4" /> Leads
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 px-3">
            <CreditCard className="w-4 h-4" /> Billing
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 px-3">
            <Settings className="w-4 h-4" /> Settings
          </Button>
        </nav>

        <div className="mt-auto pt-8 border-t border-zinc-900">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold">GA</div>
            <div>
              <p className="text-xs font-bold text-white">Graeme York</p>
              <p className="text-[10px] text-zinc-500">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 lg:px-10 bg-black/50 backdrop-blur-xl">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search everything..." 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="p-2 hidden sm:flex"><Bell className="w-5 h-5" /></Button>
            <Button variant="default" className="px-3 py-2 text-xs sm:text-sm">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Member</span>
            </Button>
          </div>
        </header>

        <main className="p-6 lg:p-10 space-y-8 overflow-y-auto">
          {/* Metrics Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <MetricCard label="Total Revenue" value="$24,530" change="+12.5%" icon={DollarSign} color="text-white" />
            <MetricCard label="Active Members" value="428" change="+4.2%" icon={Users} color="text-white" />
            <MetricCard label="New Leads" value="64" change="+18.7%" icon={UserPlus} color="text-white" />
            <MetricCard label="Bookings" value="1,246" change="+2.4%" icon={Calendar} color="text-white" />
          </section>

          {/* Performance Chart Area */}
          <section>
            <Card className="p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Performance Overview</h3>
                  <p className="text-xs text-zinc-500">Revenue and attendance growth over time.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    <Button variant="ghost" className="text-[10px] px-3 py-1 h-auto font-bold uppercase tracking-wider bg-zinc-800 text-white">Revenue</Button>
                    <Button variant="ghost" className="text-[10px] px-3 py-1 h-auto font-bold uppercase tracking-wider">Attendance</Button>
                  </div>
                </div>
              </div>
              
              {/* Mock Chart Visualization */}
              <div className="h-[300px] w-full flex items-end justify-between gap-2 px-2 relative">
                <div className="absolute inset-0 grid grid-rows-4 pointer-events-none">
                  {[...Array(4)].map((_, i) => <div key={i} className="border-t border-zinc-900/50 w-full" />)}
                </div>
                {[45, 52, 48, 61, 72, 68, 85, 78, 92, 88, 95, 100].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative z-10">
                    <div className="w-full bg-white/5 rounded-t-sm relative overflow-hidden group-hover:bg-white/10 transition-all cursor-pointer" style={{ height: `${val}%` }}>
                      <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* Lists Grid */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Recent Bookings */}
            <div>
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Recent Class Bookings</h3>
                <Button variant="ghost" className="text-[10px] p-0 h-auto uppercase tracking-tighter">View All</Button>
              </div>
              <Card className="overflow-hidden">
                <div className="divide-y divide-zinc-900">
                  {[
                    { name: "Alex Rivera", class: "HIIT Training", time: "09:00 AM", status: "Confirmed" },
                    { name: "Sarah Chen", class: "Yoga Flow", time: "10:30 AM", status: "Confirmed" },
                    { name: "James Wilson", class: "Strength Lab", time: "05:00 PM", status: "Waitlist" },
                    { name: "Emma Thompson", class: "HIIT Training", time: "06:30 PM", status: "Confirmed" },
                  ].map((booking, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                          {booking.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{booking.name}</p>
                          <p className="text-xs text-zinc-500">{booking.class}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-bold text-white">{booking.time}</p>
                          <p className={`text-[10px] font-black uppercase ${booking.status === 'Waitlist' ? 'text-amber-500' : 'text-emerald-500'}`}>{booking.status}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Member Leads */}
            <div>
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Member Leads</h3>
                <Button variant="ghost" className="text-[10px] p-0 h-auto uppercase tracking-tighter">Manage Leads</Button>
              </div>
              <Card className="overflow-hidden">
                <div className="divide-y divide-zinc-900">
                  {[
                    { name: "Marcus Wright", source: "Instagram", date: "Today", score: 92 },
                    { name: "Elena Rodriguez", source: "Website", date: "Yesterday", score: 85 },
                    { name: "Chris Bacon", source: "Referral", date: "2 days ago", score: 78 },
                    { name: "John Wick", source: "Direct", date: "3 days ago", score: 95 },
                  ].map((lead, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                          {lead.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{lead.name}</p>
                          <p className="text-xs text-zinc-500">{lead.source} • {lead.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">Score</span>
                          <span className="text-xs font-black text-emerald-500">{lead.score}</span>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-zinc-800 group-hover:text-zinc-400 transition-colors cursor-pointer" />
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
