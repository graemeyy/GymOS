import { prisma } from "@/lib/prisma";
import { 
  Users, 
  Activity, 
  DollarSign, 
  AlertTriangle, 
  ShieldCheck, 
  Wrench, 
  Cpu, 
  Plus, 
  TrendingUp, 
  ArrowUpRight, 
  ChevronRight,
  Search,
  Bell,
  Settings,
  MoreHorizontal
} from "lucide-react";
import React from "react";

// --- Server Actions / Data Fetching ---
async function getDashboardData() {
  const [memberCount, checkInCount, atRiskCount, members, equipment] = await Promise.all([
    prisma.member.count(),
    prisma.checkIn.count({
      where: {
        timestamp: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.member.count({
      where: {
        OR: [
          { status: "PAST_DUE" },
          { retentionScore: { lt: 25 } }
        ]
      },
    }),
    prisma.member.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.equipment.findMany({
      where: { status: "OFFLINE" },
      take: 3,
    }),
  ]);

  return {
    stats: [
      { label: "Total Members", value: memberCount.toLocaleString(), change: "+12%", icon: Users, color: "text-blue-500" },
      { label: "Check-ins Today", value: checkInCount.toString(), change: "+5%", icon: Activity, color: "text-emerald-500" },
      { label: "Monthly Revenue", value: "$42,850", change: "+18%", icon: DollarSign, color: "text-white" },
      { label: "At-Risk Members", value: atRiskCount.toString(), change: "-2%", icon: AlertTriangle, color: "text-amber-500" },
    ],
    recentMembers: members,
    maintenanceItems: equipment,
  };
}

// --- UI Components (Shadcn Zinc Inspired) ---
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "warning" | "danger" | "success" }) => {
  const styles = {
    default: "bg-zinc-800 text-zinc-400",
    warning: "bg-amber-500/10 text-amber-500",
    danger: "bg-red-500/10 text-red-500",
    success: "bg-emerald-500/10 text-emerald-500",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tight ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default async function DashboardPage() {
  const data = await getDashboardData();
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800">
      {/* Nav */}
      <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold tracking-tighter text-white">GymOS</span>
            <div className="hidden md:flex items-center gap-6 text-sm text-zinc-500">
              <a href="#" className="text-white">Overview</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Members</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Inventory</a>
              <a href="#" className="hover:text-zinc-300 transition-colors">Revenue</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-500 hover:text-white transition-colors"><Bell className="w-5 h-5" /></button>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold">GY</div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Iron Sanctuary</h1>
            <p className="text-zinc-500 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Facility Active • {currentDate}
            </p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
              <Plus className="w-4 h-4" /> New Member
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {data.stats.map((stat) => (
            <Card key={stat.label} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <Badge variant={stat.change.startsWith("+") ? "success" : "warning"}>{stat.change}</Badge>
              </div>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Churn Shield Agent Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-blue-500" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Churn Shield Agent</h2>
                </div>
                <Badge>Autonomous</Badge>
              </div>
              <Card className="p-0">
                <div className="divide-y divide-zinc-800">
                  {data.recentMembers.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-zinc-950/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                          {member.name?.split(" ").map(n => n[0]).join("") || "M"}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{member.name}</h4>
                          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{member.plan} • {member.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden md:block text-right">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">Retention Score</p>
                          <p className={`text-xs font-bold ${member.retentionScore >= 70 ? "text-emerald-500" : member.retentionScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                            {member.retentionScore}%
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-zinc-950/50 border-t border-zinc-800">
                  <button className="w-full text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-white transition-colors">
                    View Full Retention Report
                  </button>
                </div>
              </Card>
            </section>

            {/* Maintenance Oracle Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Wrench className="w-5 h-5 text-amber-500" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Maintenance Oracle</h2>
                </div>
                <Badge variant="warning">3 Actions Pending</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.maintenanceItems.map((item) => (
                  <Card key={item.id} className="p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-sm font-bold text-white">{item.name}</h4>
                        <Badge variant={item.urgency === "High" ? "danger" : "warning"}>{item.urgency}</Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mb-6">{item.issue}</p>
                    </div>
                    <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                      <Cpu className="w-3 h-3" /> Auto-Draft PO
                    </button>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <Card className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-950">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Revenue Growth</h3>
              </div>
              <div className="mb-8">
                <div className="text-4xl font-bold text-white mb-2">$12,482.00</div>
                <p className="text-xs text-zinc-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">+12.4%</span> vs last month
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Target</span>
                  <span className="text-white font-bold">$15,000</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-white h-full w-[82%]" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Autonomous Feed</h3>
              <div className="space-y-6">
                {[
                  { icon: ShieldCheck, color: "text-blue-500", text: "Agent blocked suspicious check-in attempt at 3:12 AM", time: "2h ago" },
                  { icon: Wrench, color: "text-amber-500", text: "Oracle detected belt slippage on Treadmill #4", time: "4h ago" },
                  { icon: Activity, color: "text-emerald-500", text: "Peak capacity reached (92%). Automation enabled cooling fans.", time: "6h ago" },
                ].map((log, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-0.5"><log.icon className={`w-4 h-4 ${log.color}`} /></div>
                    <div>
                      <p className="text-xs text-zinc-300 leading-relaxed mb-1">{log.text}</p>
                      <p className="text-[10px] font-bold text-zinc-600 uppercase">{log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
