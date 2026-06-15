import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Cpu,
  RefreshCw,
  MessageSquare,
  Bot,
  Terminal,
  Shield,
  Key,
  PieChart,
  BarChart3,
  LineChart,
  ArrowDownRight,
  UserCheck,
  Wrench,
  SearchCode,
  ShoppingCart,
  MessageCircle,
  Eye,
  Send,
  Construction
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
  { name: 'David Miller', lastSeen: '14 days ago', plan: 'Basic', risk: 'High', reason: 'Declining attendance' },
  { name: 'Elena Rodriguez', lastSeen: '10 days ago', plan: 'Premium', risk: 'Medium', reason: 'Expired card' },
  { name: 'Chris P. Bacon', lastSeen: '22 days ago', plan: 'Elite', risk: 'High', reason: 'Zero activity' },
];

const MAINTENANCE_GEAR = [
  { id: 1, item: 'Technogym Treadmill #4', status: 'Offline', issue: 'Belt Slippage', part: 'Drive Belt V-22', cost: '$145.00', urgency: 'High' },
  { id: 2, item: 'Cable Crossover (Left)', status: 'Worn', issue: 'Cable Fraying', part: 'Steel Coated Cable 3.5m', cost: '$89.00', urgency: 'Medium' },
  { id: 3, item: 'Concept2 Rower #2', status: 'Noisy', issue: 'Chain dry', part: 'Chain Lube / Replacement', cost: '$12.00', urgency: 'Low' },
];

// --- Components ---

const ChurnShield = () => {
  const [activeDraft, setActiveDraft] = useState<number | null>(null);

  const drafts = [
    { id: 1, name: 'David Miller', days: 14, message: "Hey David! Haven't seen you at the Iron Sanctuary in a bit. Hope all's well! Just a heads up we've got some new plates arriving Tuesday if you're looking for a sign to head back in. – Graeme" },
    { id: 2, name: 'Elena Rodriguez', days: 10, message: "Hi Elena! Missed you at the 6PM HIIT sessions lately. No pressure, just checking in to see if you're doing okay! Cheers, Team GymOS" },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="font-bold text-lg tracking-tight">Churn Shield</h3>
        </div>
        <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">Predictive</span>
      </div>

      <div className="space-y-4">
        {drafts.map((draft) => (
          <div key={draft.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden transition-all border-l-4 border-l-blue-500/40">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold">
                  {draft.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{draft.name}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Missed {draft.days} Days</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveDraft(activeDraft === draft.id ? null : draft.id)}
                className="p-2 hover:bg-zinc-900 rounded-lg transition-colors text-zinc-500 hover:text-white"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
            
            {activeDraft === draft.id && (
              <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-3">
                  <p className="text-xs text-zinc-400 italic leading-relaxed">"{draft.message}"</p>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-zinc-100 text-zinc-950 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    <Send className="w-3 h-3" /> Send Text
                  </button>
                  <button className="px-3 bg-zinc-800 text-zinc-400 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Edit</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const MaintenanceOracle = () => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <Wrench className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="font-bold text-lg tracking-tight">Maintenance Oracle</h3>
        </div>
        <div className="flex -space-x-2">
           {[1, 2].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[8px] font-bold">SM</div>)}
        </div>
      </div>

      <div className="space-y-4">
        {MAINTENANCE_GEAR.map((item) => (
          <div key={item.id} className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 group hover:bg-zinc-950 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-sm font-bold text-white">{item.item}</h4>
                <p className="text-[10px] text-zinc-500">{item.issue}</p>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${
                item.urgency === 'High' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
              }`}>
                {item.urgency}
              </span>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-900">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-900 rounded-lg border border-zinc-800">
                  <SearchCode className="w-3 h-3 text-zinc-500" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Found Replacement</p>
                  <p className="text-[10px] text-zinc-300">{item.part}</p>
                </div>
              </div>
              <button className="bg-zinc-100 text-zinc-950 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white transition-all">
                <ShoppingCart className="w-3 h-3" />
                Draft Order
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-6 py-3 border border-zinc-800 rounded-xl text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-950 transition-all">
        <Construction className="w-4 h-4" />
        Report Facility Issue
      </button>
    </div>
  );
};

const CheckoutPanel = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [issueKeycard, setIssueKeycard] = useState(true);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Onboard Member</h3>
            <p className="text-sm text-zinc-500">Walk-in registration & checkout</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">First Name</label>
                <input type="text" placeholder="John" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-600 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Last Name</label>
                <input type="text" placeholder="Doe" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-600 outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
              <input type="email" placeholder="john@example.com" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-600 outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Select Plan</label>
            <div className="grid grid-cols-2 gap-3">
              {['Basic • $49', 'Premium • $89', 'Platinum • $149', 'Elite • $299'].map((plan, i) => (
                <button key={plan} className={`p-4 rounded-2xl border transition-all text-left ${i === 2 ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'}`}>
                  <p className="text-xs font-bold">{plan.split(' • ')[0]}</p>
                  <p className="text-lg font-black">{plan.split(' • ')[1]}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-900 rounded-xl">
                <Key className="w-4 h-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Issue Physical Keycard</p>
                <p className="text-[10px] text-zinc-500">Enable instant entry access</p>
              </div>
            </div>
            <button 
              onClick={() => setIssueKeycard(!issueKeycard)}
              className={`w-12 h-6 rounded-full transition-colors relative ${issueKeycard ? 'bg-zinc-100' : 'bg-zinc-800'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${issueKeycard ? 'right-1 bg-zinc-900' : 'left-1 bg-zinc-500'}`} />
            </button>
          </div>
        </div>

        <div className="p-8 border-t border-zinc-800 bg-zinc-900/50">
          <button className="w-full bg-zinc-100 text-zinc-950 hover:bg-white py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5">
            Complete Checkout & Activate
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const VitalsAnalytics = () => {
  return (
    <div className="space-y-8">
      {/* Attendance Trends */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-zinc-500" />
              Attendance Spikes
            </h3>
            <p className="text-xs text-zinc-500">Real-time floor occupancy</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-emerald-400">92%</p>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Peak Capacity</p>
          </div>
        </div>
        
        <div className="flex items-end justify-between h-32 gap-2">
          {ATTENDANCE_SPIKES.map((data) => (
            <div key={data.hour} className="flex-1 flex flex-col items-center gap-3">
              <div className="w-full bg-zinc-800 rounded-t-lg relative group overflow-hidden" style={{ height: `${data.level}%` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-100 to-white opacity-0 group-hover:opacity-20 transition-opacity" />
                {data.level > 80 && <div className="absolute top-0 left-0 right-0 h-1 bg-white animate-pulse" />}
              </div>
              <span className="text-[10px] font-bold text-zinc-500">{data.hour}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-4">
              <LineChart className="w-4 h-4" />
              <span>Q3 REVENUE PROJECTION</span>
            </div>
            <div className="text-3xl font-black">$128.4k</div>
            <div className="flex items-center gap-1 text-emerald-400 text-xs mt-1 font-bold">
              <ArrowUpRight className="w-3 h-3" />
              +24% YoY
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2">Confidence Score</p>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-zinc-100 h-full w-[88%]" />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 bg-gradient-to-br from-zinc-900 to-rose-950/20">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest">Churn Warning</h4>
            <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="space-y-4">
            {AT_RISK_MEMBERS.slice(0, 2).map((member) => (
              <div key={member.name} className="bg-zinc-950/50 border border-rose-500/10 p-3 rounded-2xl">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-bold">{member.name}</p>
                  <span className="text-[10px] font-black text-rose-400 px-1.5 py-0.5 bg-rose-500/10 rounded-md">HIGH RISK</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">{member.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const AIAgentFeed = () => {
  const [logs, setLogs] = useState(AGENT_TASKS);
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLogs = [...prev];
        const last = newLogs.pop();
        if (last) newLogs.unshift(last);
        return newLogs;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col h-full overflow-hidden">
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-800 rounded-lg">
            <Cpu className="w-4 h-4 text-zinc-100" />
          </div>
          <h2 className="font-bold text-sm tracking-tight text-white uppercase">AI Agent Feed</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Autonomous</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {logs.map((log, i) => {
            const Config = AGENT_LOG_TYPES[log.type as keyof typeof AGENT_LOG_TYPES];
            return (
              <div 
                key={i} 
                className={`p-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 flex gap-3 transition-all duration-500 ${i === 0 ? 'scale-105 border-zinc-700 bg-zinc-900' : 'opacity-60'}`}
              >
                <div className={`mt-0.5 p-1.5 rounded-xl h-fit ${Config.bg}`}>
                  <Config.icon className={`w-3.5 h-3.5 ${Config.color}`} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-200 leading-relaxed font-medium">{log.message}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">{log.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
        <div className="p-6 overflow-y-auto space-y-8">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-zinc-100">{member.plan}</span>
              </div>
            </div>
          </div>
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
      <div className="relative bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
           <h3 className="text-xl font-bold text-white">Billing & Payouts</h3>
           <button onClick={onClose}><X className="w-5 h-5 text-zinc-500" /></button>
        </div>
        <div className="p-6">
           <p className="text-zinc-500 text-sm">Configure your payment settlement preferences.</p>
        </div>
      </div>
    </div>
  );
};

export default function GymOSDashboard() {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800">
      <MemberModal member={selectedMember} isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} />
      <BillingSettings isOpen={isBillingOpen} onClose={() => setIsBillingOpen(false)} />
      <CheckoutPanel isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />

      <nav className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">GymOS</span>
            <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
              <a href="#" className="text-white">Dashboard</a>
              <a href="#">Members</a>
              <button onClick={() => setIsBillingOpen(true)}>Revenue</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs">GA</div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Iron Sanctuary</h1>
            <p className="text-zinc-500 text-sm">{currentDate}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsCheckoutOpen(true)} className="bg-zinc-100 text-zinc-950 px-5 py-2.5 rounded-2xl text-sm font-black flex items-center gap-2 transition-all">
              <UserPlus className="w-4 h-4" /> Onboard Member
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl bg-zinc-950 border border-zinc-800 ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-emerald-400">{stat.change}</span>
              </div>
              <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-black mt-1 tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-10">
            {/* Churn Shield Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="w-5 h-5 text-zinc-500" />
                <h2 className="text-xl font-black tracking-tight uppercase">Churn Shield</h2>
              </div>
              <ChurnShield />
            </section>

            {/* Maintenance Oracle Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Wrench className="w-5 h-5 text-zinc-500" />
                <h2 className="text-xl font-black tracking-tight uppercase">Maintenance Oracle</h2>
              </div>
              <MaintenanceOracle />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-zinc-500" />
                <h2 className="text-xl font-black tracking-tight uppercase">Vitals & Analytics</h2>
              </div>
              <VitalsAnalytics />
            </section>
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-4 space-y-8">
            <AIAgentFeed />
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="font-bold text-sm text-white uppercase tracking-widest mb-4">Facility Status</h3>
              <div className="space-y-3">
                 <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500" />
                       <span className="text-xs text-zinc-300">HVAC System</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">OPTIONAL</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-amber-500" />
                       <span className="text-xs text-zinc-300">Front Keypad</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">LATENCY</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
