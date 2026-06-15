import React from 'react';
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
UserPlus
} from 'lucide-react';

// --- Mock Data ---
const STATS = [
{ label: 'Total Members', value: '1,284', change: '+12%', icon: Users, color: 'text-blue-500' },
{ label: 'Check-ins Today', value: '142', change: '+5%', icon: Activity, color: 'text-emerald-500' },
{ label: 'Monthly Revenue', value: '$42,850', change: '+18%', icon: DollarSign, color: 'text-zinc-100' },
{ label: 'At-Risk Members', value: '24', change: '-2%', icon: AlertTriangle, color: 'text-amber-500' },
];

const RECENT_ACTIVITY = [
{ id: 1, member: 'Alex Rivera', action: 'Checked in', time: '2 mins ago', status: 'Active' },
{ id: 2, member: 'Sarah Chen', action: 'Renewed Platinum', time: '15 mins ago', status: 'Success' },
{ id: 3, member: 'James Wilson', action: 'Class Booked: HIIT', time: '45 mins ago', status: 'Active' },
{ id: 4, member: 'Emma Thompson', action: 'Payment Failed', time: '1 hour ago', status: 'Warning' },
{ id: 5, member: 'Marcus Wright', action: 'New Sign-up', time: '3 hours ago', status: 'Success' },
];

const AT_RISK_MEMBERS = [
{ name: 'David Miller', lastSeen: '14 days ago', plan: 'Basic', risk: 'High' },
{ name: 'Elena Rodriguez', lastSeen: '10 days ago', plan: 'Premium', risk: 'Medium' },
{ name: 'Chris P. Bacon', lastSeen: '22 days ago', plan: 'Elite', risk: 'High' },
];

export default function GymOSDashboard() {
const currentDate = new Date().toLocaleDateString('en-US', {
weekday: 'long',
year: 'numeric',
month: 'long',
day: 'numeric'
});

return (
<div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800">
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
<a href="#" className="hover:text-white transition-colors">Revenue</a>
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
<div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium">
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
<button className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
Export Vitals
</button>
</div>
</header>

{/* Stats Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
{STATS.map((stat) => (
<div key={stat.label} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
<div className="flex justify-between items-start mb-4">
<div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${stat.color}`}>
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
<h2 className="font-semibold flex items-center gap-2">
<Activity className="w-4 h-4 text-zinc-500" />
Recent Activity
</h2>
<button className="text-xs text-zinc-500 hover:text-white transition-colors">View All</button>
</div>
<div className="divide-y divide-zinc-800">
{RECENT_ACTIVITY.map((item) => (
<div key={item.id} className="p-4 hover:bg-zinc-950 transition-colors flex items-center justify-between group">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs">
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
<ChevronRight className="w-4 h-4 text-zinc-700" />
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
<div key={member.name} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
<div>
<p className="text-sm font-medium">{member.name}</p>
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
<button className="w-full mt-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-2 rounded-xl text-xs font-semibold transition-colors">
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
