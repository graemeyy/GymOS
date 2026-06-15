import React, { useState } from 'react';
import {
  Users,
  Activity,
  DollarSign,
  AlertTriangle,
  Search,
  Bell,
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  UserPlus,
  X,
  Calendar,
  Clock,
  History,
  CreditCard,
  Settings,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// --- Mock Data ---
const STATS = [
  { label: 'Total Members', value: '1,284', change: '+12%', icon: Users, color: 'text-blue-500' },
  { label: 'Check-ins Today', value: '142', change: '+5%', icon: Activity, color: 'text-emerald-500' },
  { label: 'Monthly Revenue', value: '$42,850', change: '+18%', icon: DollarSign, color: 'text-zinc-100' },
  { label: 'At-Risk Members', value: '24', change: '-2%', icon: AlertTriangle, color: 'text-amber-500' },
];

const RECENT_ACTIVITY = [
  { id: 1, member: 'Alex Rivera', action: 'Checked in', time: '2 mins ago', status: 'Active', email: 'alex@example.com', plan: 'Platinum', joinDate: 'Jan 12, 2024', lastCheckIn: 'Today, 4:29 PM' },
  { id: 2, member: 'Sarah Chen', action: 'Renewed Platinum', time: '15 mins ago', status: 'Success', email: 'sarah.c@example.com', plan: 'Platinum', joinDate: 'Nov 05, 2023', lastCheckIn: 'Today, 4:16 PM' },
  { id: 3, member: 'James Wilson', action: 'Class Booked: HIIT', time: '45 mins ago', status: 'Active', email: 'j.wilson@example.com', plan: 'Basic', joinDate: 'Mar 20, 2024', lastCheckIn: 'Today, 3:46 PM' },
  { id: 4, member: 'Emma Thompson', action: 'Payment Failed', time: '1 hour ago', status: 'Warning', email: 'emma.t@example.com', plan: 'Premium', joinDate: 'Feb 14, 2024', lastCheckIn: 'Yesterday' },
  { id: 5, member: 'Marcus Wright', action: 'New Sign-up', time: '3 hours ago', status: 'Success', email: 'm.wright@example.com', plan: 'Premium', joinDate: 'Jun 15, 2026', lastCheckIn: 'Today, 1:31 PM' },
];

const AT_RISK_MEMBERS = [
  { name: 'David Miller', lastSeen: '14 days ago', plan: 'Basic', risk: 'High' },
  { name: 'Elena Rodriguez', lastSeen: '10 days ago', plan: 'Premium', risk: 'Medium' },
  { name: 'Chris P. Bacon', lastSeen: '22 days ago', plan: 'Elite', risk: 'High' },
];

// --- Components ---

const MemberModal = ({ member, isOpen, onClose }: { member: any, isOpen: boolean, onClose: () => void }) => {
  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-lg text-white">
              {member.member.split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{member.member}</h3>
              <p className="text-sm text-zinc-500">{member.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Quick Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-zinc-100">{member.plan}</span>
              </div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-zinc-100">Active</span>
              </div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Member Since</p>
              <div className="flex items-center gap-2 text-zinc-100">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <span className="font-semibold">{member.joinDate}</span>
              </div>
            </div>
          </div>

          {/* History */}
          <section>
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <History className="w-4 h-4" />
              Check-in History
            </h4>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 px-4 bg-zinc-950/50 border border-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 rounded-lg">
                      <Clock className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Main Entrance</p>
                      <p className="text-xs text-zinc-500">June {15 - i}, 2026</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">18:42</span>
                </div>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section>
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Staff Notes</h4>
            <textarea 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700 min-h-[100px] resize-none"
              placeholder="Add a note about this member..."
              defaultValue="Recovering from minor knee injury. Prefers morning HIIT sessions."
            />
          </section>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex gap-3">
          <button className="flex-1 bg-zinc-100 text-zinc-950 hover:bg-white py-3 rounded-xl font-bold transition-colors text-sm">
            Freeze Membership
          </button>
          <button className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition-colors text-sm">
            Message Member
          </button>
        </div>
      </div>
    </div>
  );
};

const BillingSettings = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-xl text-zinc-950">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Billing & Payouts</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Active Payout Method</h4>
              <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">Edit</button>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 bg-zinc-900 border border-zinc-800 rounded-md flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Bank Account •••• 4242</p>
                  <p className="text-xs text-zinc-500">Last payout: June 1, 2026</p>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Payout Schedule</h4>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 rounded-2xl border-2 border-zinc-100 bg-zinc-950 text-left transition-all">
                <div className="flex justify-between items-center mb-2">
                  <Zap className="w-4 h-4 text-zinc-100" />
                  <span className="text-[10px] font-bold text-zinc-500">RECOMMENDED</span>
                </div>
                <p className="font-bold text-zinc-100">Weekly</p>
                <p className="text-xs text-zinc-500 mt-1">Every Monday</p>
              </button>
              <button className="p-4 rounded-2xl border-2 border-transparent bg-zinc-950 text-left hover:border-zinc-800 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <Calendar className="w-4 h-4 text-zinc-600" />
                </div>
                <p className="font-bold text-zinc-400">Monthly</p>
                <p className="text-xs text-zinc-600 mt-1">1st of the month</p>
              </button>
            </div>
          </section>

          <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200/70 leading-relaxed">
              Payouts are subject to a 2.9% + $0.30 processing fee. Your next scheduled payout of <strong>$12,450.00</strong> will be initiated on Monday, June 22.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
          <button onClick={onClose} className="bg-zinc-100 text-zinc-950 hover:bg-white px-6 py-2.5 rounded-xl font-bold transition-colors text-sm">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default function GymOSDashboard() {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800">
      <MemberModal 
        member={selectedMember} 
        isOpen={!!selectedMember} 
        onClose={() => setSelectedMember(null)} 
      />
      <BillingSettings 
        isOpen={isBillingOpen} 
        onClose={() => setIsBillingOpen(false)} 
      />

      {/* Top Navigation */}
      <nav className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
              GymOS
            </span>
            <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
              <a href="#" className="text-white hover:text-white transition-colors">Dashboard</a>
              <a href="#" className="hover:text-white transition-colors">Members</a>
              <button onClick={() => setIsBillingOpen(true)} className="hover:text-white transition-colors">Revenue</button>
              <a href="#" className="hover:text-white transition-colors">Settings</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search members..."
                className="bg-zinc-900 border border-zinc-800 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 w-64 transition-all"
              />
            </div>
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium cursor-pointer hover:border-zinc-500 transition-colors">
              GA
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Iron Sanctuary</h1>
            <p className="text-zinc-500 text-sm">{currentDate}</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-zinc-100 text-zinc-950 hover:bg-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>
            <button 
              onClick={() => setIsBillingOpen(true)}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Payout Settings
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl hover:border-zinc-700 transition-colors cursor-default group">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 ${
                  stat.change.startsWith('+') ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold mt-1 tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Recent Activity Feed */}
          <section className="lg:col-span-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="font-semibold flex items-center gap-2 text-zinc-100">
                  <Activity className="w-4 h-4 text-zinc-500" />
                  Recent Activity
                </h2>
                <button className="text-xs text-zinc-500 hover:text-white transition-colors">View All</button>
              </div>
              <div className="divide-y divide-zinc-800">
                {RECENT_ACTIVITY.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedMember(item)}
                    className="p-4 hover:bg-zinc-950 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs group-hover:border-zinc-500 transition-colors">
                        {item.member.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-medium group-hover:text-white transition-colors">{item.member}</p>
                        <p className="text-xs text-zinc-500">{item.action} &bull; {item.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                        item.status === 'Success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        item.status === 'Warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {item.status}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* At-Risk / Churn List */}
          <section className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  At-Risk Members
                </h2>
              </div>
              <div className="space-y-4">
                {AT_RISK_MEMBERS.map((member) => (
                  <div key={member.name} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl hover:border-zinc-700 transition-colors cursor-pointer group">
                    <div>
                      <p className="text-sm font-medium group-hover:text-white transition-colors">{member.name}</p>
                      <p className="text-xs text-zinc-500">Last seen {member.lastSeen}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md text-zinc-400 block mb-1">
                        {member.plan}
                      </span>
                      <span className={`text-xs font-bold ${member.risk === 'High' ? 'text-rose-500' : 'text-amber-500'}`}>
                        {member.risk} Risk
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-2.5 rounded-xl text-xs font-bold transition-all border border-zinc-700 hover:border-zinc-600">
                Run Retention Agent
              </button>
            </div>

            {/* Quick Stats Mini-Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 bg-gradient-to-br from-zinc-900 to-zinc-950">
              <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
                <TrendingUp className="w-3 h-3" />
                <span>Conversion Rate</span>
              </div>
              <div className="text-2xl font-bold mb-1">4.2%</div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white h-full w-[42%]"></div>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2">+0.4% from last week</p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
