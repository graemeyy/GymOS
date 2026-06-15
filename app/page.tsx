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
  UserCheck
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

const AGENT_LOG_TYPES = {
  RESOLVE: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ACTION: { icon: Zap, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  SHIELD: { icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  NOTIFY: { icon: Bell, color: 'text-amber-500', bg: 'bg-amber-500/10' },
};

const AGENT_TASKS = [
  { type: 'RESOLVE', message: 'Resolved billing dispute for Alex Rivera ($45.00 refund processed).', time: 'Just now' },
  { type: 'ACTION', message: 'Automatically paused membership for Sarah Chen (Injury noted in email).', time: '2m ago' },
  { type: 'SHIELD', message: 'Blocked fraudulent login attempt from unknown IP (Stuttgart, DE).', time: '5m ago' },
  { type: 'ACTION', message: 'Updated expired credit card for Marcus Wright via automated outreach.', time: '12m ago' },
  { type: 'NOTIFY', message: 'Waived late fee for James Wilson (First-time occurrence).', time: '18m ago' },
];

const ATTENDANCE_SPIKES = [
  { hour: '6AM', level: 85 },
  { hour: '9AM', level: 40 },
  { hour: '12PM', level: 65 },
  { hour: '5PM', level: 95 },
  { hour: '8PM', level: 70 },
  { hour: '11PM', level: 20 },
];

// --- Components ---

const CheckoutPanel = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [step, setStep] = useState(1);
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

      {/* Projections & Churn */}
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
          <button className="w-full mt-4 text-[10px] font-black text-zinc-400 hover:text-white transition-colors uppercase tracking-widest">
            Deploy Retention Squad
          </button>
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
                  <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                    {log.message}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">{log.time}</span>
                    <span className="text-[10px] text-zinc-700">•</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">GymOS-L4</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
      </div>
      
      <div className="p-4 border-t border-zinc-800 bg-zinc-950/30">
        <button className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
          <Terminal className="w-3 h-3" />
          Full Terminal
        </button>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
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
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

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
      <CheckoutPanel
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
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
            <button 
              onClick={() => setIsCheckoutOpen(true)}
              className="bg-zinc-100 text-zinc-950 hover:bg-white px-5 py-2.5 rounded-2xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-white/5"
            >
              <UserPlus className="w-4 h-4" />
              Onboard Member
            </button>
            <button 
              onClick={() => setIsBillingOpen(true)}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-5 py-2.5 rounded-2xl text-sm font-black transition-colors flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Payout Settings
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-zinc-700 transition-colors cursor-default group">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl bg-zinc-950 border border-zinc-800 ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 ${
                  stat.change.startsWith('+') ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-black mt-1 tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left/Main Content */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* Vitals & Analytics Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-zinc-500" />
                <h2 className="text-xl font-black tracking-tight uppercase">Vitals & Analytics</h2>
              </div>
              <VitalsAnalytics />
            </section>

            {/* Recent Activity Feed */}
            <section>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                  <h2 className="font-bold flex items-center gap-2 text-zinc-100">
                    <Activity className="w-4 h-4 text-zinc-500" />
                    Floor Activity
                  </h2>
                  <button className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">History</button>
                </div>
                <div className="divide-y divide-zinc-800">
                  {RECENT_ACTIVITY.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedMember(item)}
                      className="p-5 hover:bg-zinc-950 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs group-hover:border-zinc-500 transition-colors">
                          {item.member.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold group-hover:text-white transition-colors">{item.member}</p>
                          <p className="text-xs text-zinc-500">{item.action} &bull; {item.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                          item.status === 'Success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          item.status === 'Warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        }`}>
                          {item.status}
                        </span>
                        <ArrowUpRight className="w-5 h-5 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar: AI Agent Feed */}
          <div className="lg:col-span-4 space-y-8">
            <div className="h-[600px] lg:sticky lg:top-24">
              <AIAgentFeed />
            </div>
            
            {/* Quick Action: New Onboarding Trigger */}
            <div className="p-1 bg-gradient-to-br from-zinc-700 to-zinc-900 rounded-[2rem]">
               <button 
                 onClick={() => setIsCheckoutOpen(true)}
                 className="w-full bg-zinc-950 border border-zinc-800/50 hover:bg-zinc-900 p-6 rounded-[1.8rem] transition-all group"
               >
                 <div className="flex items-center gap-4 text-left">
                   <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 group-hover:scale-110 transition-transform">
                     <UserCheck className="w-6 h-6 text-white" />
                   </div>
                   <div>
                     <p className="text-sm font-black text-white uppercase tracking-tighter">Instant Signup</p>
                     <p className="text-xs text-zinc-500">Register walk-in member now</p>
                   </div>
                 </div>
               </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
