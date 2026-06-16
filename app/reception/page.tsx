"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  UserCheck, 
  AlertCircle, 
  Activity, 
  History, 
  CheckCircle2, 
  XCircle, 
  CreditCard 
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ReceptionDashboard() {
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRecent = async () => {
    try {
      const res = await fetch("/api/check-in");
      if (res.ok) {
        const data = await res.json();
        setRecentCheckIns(data);
      }
    } catch (e) {
      console.error("Failed to fetch check-ins");
    }
  };

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          memberId: searchInput.includes("@") ? null : searchInput,
          email: searchInput.includes("@") ? searchInput : null
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Check-in failed");
        setLastScanned(null);
      } else {
        setLastScanned(data);
        setSearchInput("");
        fetchRecent();
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GymOS Reception</h1>
            <p className="text-zinc-500 text-sm">Live member check-in & tracking</p>
          </div>
          <div className="flex items-center gap-4 text-xs bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live System
            </span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400">{new Date().toLocaleTimeString()}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Action Area */}
          <div className="lg:col-span-8 space-y-6">
            {/* Scanner Input */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
              <form onSubmit={handleCheckIn} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Scan keycard or enter member ID/email..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-5 pl-14 pr-4 text-xl focus:ring-2 focus:ring-white/10 focus:border-zinc-700 outline-none transition-all placeholder:text-zinc-700"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  disabled={loading}
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white text-black px-6 py-2.5 rounded-lg font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {loading ? "Checking..." : "Check In"}
                </button>
              </form>
              {error && (
                <div className="mt-4 flex items-center gap-2 text-rose-500 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}
            </div>

            {/* Status Card */}
            {lastScanned && (
              <div className={cn(
                "animate-in fade-in slide-in-from-bottom-4 duration-500 border rounded-2xl p-8",
                lastScanned.alerts.inactive ? "bg-rose-950/20 border-rose-900/50" : "bg-zinc-900/30 border-zinc-800"
              )}>
                <div className="flex items-start justify-between">
                  <div className="flex gap-6">
                    <div className={cn(
                      "w-20 h-20 rounded-2xl flex items-center justify-center border-2 shadow-inner",
                      lastScanned.alerts.inactive ? "bg-rose-900/40 border-rose-800" : "bg-zinc-800/50 border-zinc-700"
                    )}>
                      <UserCheck className={cn("w-10 h-10", lastScanned.alerts.inactive ? "text-rose-400" : "text-emerald-400")} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white">{lastScanned.member.name || "Anonymous Member"}</h2>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                          lastScanned.member.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        )}>
                          {lastScanned.member.status}
                        </span>
                        <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-xs font-medium border border-zinc-700">
                          {lastScanned.member.plan} Plan
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-500 text-sm font-medium mb-1">Retention Score</p>
                    <p className={cn(
                      "text-4xl font-black italic",
                      lastScanned.member.retentionScore > 80 ? "text-emerald-500" : lastScanned.member.retentionScore > 40 ? "text-amber-500" : "text-rose-500"
                    )}>
                      {lastScanned.member.retentionScore}%
                    </p>
                  </div>
                </div>

                {/* Alerts Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className={cn("w-4 h-4", lastScanned.alerts.inactive ? "text-rose-500" : "text-zinc-600")} />
                      <p className="text-xs font-bold uppercase text-zinc-500">Membership</p>
                    </div>
                    <p className="text-sm">{lastScanned.alerts.inactive ? "Payment Overdue" : "Up to date"}</p>
                  </div>
                  <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                    <div className="flex items-center gap-3 mb-2">
                      <CreditCard className={cn("w-4 h-4", lastScanned.alerts.needsKeycard ? "text-amber-500" : "text-zinc-600")} />
                      <p className="text-xs font-bold uppercase text-zinc-500">Access Card</p>
                    </div>
                    <p className="text-sm">{lastScanned.alerts.needsKeycard ? "Issue New Card" : "Card Active"}</p>
                  </div>
                  <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className={cn("w-4 h-4", lastScanned.alerts.lowRetention ? "text-rose-500" : "text-zinc-600")} />
                      <p className="text-xs font-bold uppercase text-zinc-500">At Risk</p>
                    </div>
                    <p className="text-sm">{lastScanned.alerts.lowRetention ? "High Churn Probability" : "Safe"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Recent Feed */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col h-[600px] overflow-hidden backdrop-blur-sm">
              <div className="p-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-zinc-400" />
                  <h3 className="font-bold text-zinc-200">Recent Entry</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-600 uppercase">Live Feed</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {recentCheckIns.map((ci: any) => (
                  <div key={ci.id} className="group p-3 rounded-xl hover:bg-zinc-800/50 transition-colors flex items-center justify-between border border-transparent hover:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-200">{ci.member.name || "Unknown"}</p>
                        <p className="text-[10px] text-zinc-500">{new Date(ci.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    {ci.member.status === "ACTIVE" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
