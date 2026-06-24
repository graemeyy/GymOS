"use client";

import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  History, 
  ArrowUpRight, 
  Download, 
  CheckCircle2, 
  Zap,
  ArrowLeft,
  DollarSign,
  Calendar,
  ShieldCheck
} from "lucide-react";

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={"bg-white border-2 border-slate-900 rounded-none p-6 " + className}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "success" | "warning" }) => {
  const styles = {
    default: "bg-white text-slate-900 border-slate-900",
    success: "bg-blue-600 text-white border-blue-600",
    warning: "bg-amber-500 text-white border-amber-500",
  };
  return (
    <span className={`text-[10px] font-black px-3 py-1 border-2 uppercase tracking-widest ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default function BillingPage() {
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
              <a href="/" className="text-slate-400 hover:text-slate-900 transition-colors">Command</a>
              <a href="/members" className="text-slate-400 hover:text-slate-900 transition-colors">Members</a>
              <a href="/billing" className="text-blue-600 border-b-2 border-blue-600 pb-1">Financials</a>
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Stripe Ledger</span>
            </div>
            <h1 className="text-7xl font-black tracking-tight uppercase leading-none mb-4">Financials</h1>
            <p className="text-slate-900 text-lg font-black uppercase tracking-widest">Revenue Ops & Subscription Matrix</p>
          </div>
          <div className="flex gap-4">
            <button className="bg-blue-600 text-white border-2 border-slate-900 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-blue-700 transition-all">
              <CreditCard className="w-4 h-4" /> Export Payouts
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <Card className="border-4 border-slate-900">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest mb-1">Monthly Recurring Revenue</h3>
                  <p className="text-5xl font-black tracking-tighter">$42,850.00</p>
                </div>
                <Badge variant="success">Active Growth</Badge>
              </div>
              <div className="h-24 bg-slate-50 border-2 border-slate-900 flex items-end p-2 gap-1">
                {[40, 70, 45, 90, 65, 80, 95, 75, 85, 100].map((h, i) => (
                  <div key={i} className="flex-1 bg-blue-600 border border-slate-900" style={{ height: `${h}%` }} />
                ))}
              </div>
            </Card>

            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-blue-600 pl-3">Recent Transactions</h3>
            <Card className="p-0 overflow-hidden border-2 border-slate-900">
              <table className="w-full">
                <thead className="bg-slate-50 border-b-2 border-slate-900">
                  <tr>
                    <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest">Entity</th>
                    <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest">Protocol</th>
                    <th className="text-left p-6 text-[10px] font-black uppercase tracking-widest">Amount</th>
                    <th className="text-right p-6 text-[10px] font-black uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100">
                  {[
                    { name: "John Wick", plan: "Platinum", amount: "$149.00", status: "Succeeded" },
                    { name: "Sarah Connor", plan: "Basic", amount: "$49.00", status: "Succeeded" },
                    { name: "Ellen Ripley", plan: "Elite", amount: "$299.00", status: "Pending" },
                  ].map((t, i) => (
                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                      <td className="p-6 font-black uppercase text-xs">{t.name}</td>
                      <td className="p-6"><Badge>{t.plan}</Badge></td>
                      <td className="p-6 font-black text-xs">{t.amount}</td>
                      <td className="p-6 text-right"><Badge variant={t.status === 'Succeeded' ? 'success' : 'default'}>{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <div className="space-y-10">
            <Card className="bg-slate-900 text-white border-2 border-slate-900">
              <div className="flex items-center gap-3 mb-6 text-blue-400">
                <ShieldCheck className="w-6 h-6" />
                <h4 className="text-xs font-black uppercase tracking-[0.2em]">Churn Shield</h4>
              </div>
              <p className="text-3xl font-black tracking-tight mb-4">84% Retention</p>
              <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
                Automated credit card recovery active. 12 failed payments recovered this period.
              </p>
            </Card>

            <Card className="border-2 border-slate-900">
              <h4 className="text-xs font-black uppercase tracking-widest mb-6">Tax Compliance</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b-2 border-slate-100">
                  <span className="text-[10px] font-black uppercase">Q2 Sales Tax</span>
                  <button className="p-2 border-2 border-slate-900 hover:bg-blue-600 hover:text-white transition-colors"><Download className="w-3 h-3" /></button>
                </div>
                <div className="flex justify-between items-center py-3 border-b-2 border-slate-100">
                  <span className="text-[10px] font-black uppercase">Annual Audit</span>
                  <button className="p-2 border-2 border-slate-900 hover:bg-blue-600 hover:text-white transition-colors"><Download className="w-3 h-3" /></button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
