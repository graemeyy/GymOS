"use client";

import React, { useState, useEffect } from "react";
import { Search, UserCheck, AlertCircle, Activity, History, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function membershipMessage(status: string): string {
  switch (status) {
    case "PAST_DUE":
      return "Payment overdue";
    case "PAUSED":
      return "Membership paused";
    case "CANCELED":
      return "Membership canceled";
    default:
      return "Up to date";
  }
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
      if (res.ok) setRecentCheckIns(await res.json());
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
          email: searchInput.includes("@") ? searchInput : null,
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
    <div className="min-h-screen bg-chalk text-ink p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-medium text-ink">Front desk</h1>
            <p className="text-ink-soft text-sm">Scan a card or enter an email to check in</p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-surface px-3 py-1.5 rounded-full border border-line text-ink-soft">
            <span className="w-2 h-2 rounded-full bg-good" />
            Live
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-surface border border-line rounded-2xl p-8">
              <form onSubmit={handleCheckIn} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft w-5 h-5" />
                <input
                  type="text"
                  placeholder="Scan card or type member ID / email"
                  className="w-full bg-chalk border border-line rounded-xl py-5 pl-14 pr-32 text-lg focus:outline-none focus:ring-2 focus:ring-ember/30 placeholder:text-ink-soft/60"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-ember text-white px-6 py-3 rounded-xl font-medium hover:bg-ember-dark transition-colors disabled:opacity-50"
                >
                  {loading ? "Checking…" : "Check in"}
                </button>
              </form>
              {error && (
                <div className="mt-4 flex items-center gap-2 text-bad bg-bad-soft p-3 rounded-xl text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>

            {lastScanned && (
              <div
                className={cn(
                  "border rounded-2xl p-8",
                  lastScanned.alerts.inactive ? "bg-bad-soft border-bad/20" : "bg-surface border-line"
                )}
              >
                <div className="flex items-start justify-between flex-wrap gap-6">
                  <div className="flex gap-5">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center",
                        lastScanned.alerts.inactive ? "bg-bad/10 text-bad" : "bg-good/10 text-good"
                      )}
                    >
                      <UserCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-medium text-ink">
                        {lastScanned.member.name || "Member"}
                      </h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium",
                            lastScanned.member.status === "ACTIVE" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
                          )}
                        >
                          {lastScanned.member.status}
                        </span>
                        <span className="bg-surface-muted text-ink-soft px-2.5 py-1 rounded-full text-xs font-medium">
                          {lastScanned.member.plan}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-ink-soft text-xs mb-1">Retention score</p>
                    <p
                      className={cn(
                        "font-display text-3xl font-medium",
                        lastScanned.member.retentionScore > 80
                          ? "text-good"
                          : lastScanned.member.retentionScore > 40
                          ? "text-warn"
                          : "text-bad"
                      )}
                    >
                      {lastScanned.member.retentionScore}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">
                  <div className="bg-surface rounded-xl border border-line p-4">
                    <div className="flex items-center gap-2 mb-1.5 text-ink-soft">
                      <AlertCircle className={cn("w-4 h-4", lastScanned.alerts.inactive && "text-bad")} />
                      <p className="text-xs font-medium">Membership</p>
                    </div>
                    <p className="text-sm text-ink">{membershipMessage(lastScanned.member.status)}</p>
                  </div>
                  <div className="bg-surface rounded-xl border border-line p-4">
                    <div className="flex items-center gap-2 mb-1.5 text-ink-soft">
                      <CreditCard className={cn("w-4 h-4", lastScanned.alerts.needsKeycard && "text-warn")} />
                      <p className="text-xs font-medium">Access card</p>
                    </div>
                    <p className="text-sm text-ink">{lastScanned.alerts.needsKeycard ? "Needs new card" : "Card active"}</p>
                  </div>
                  <div className="bg-surface rounded-xl border border-line p-4">
                    <div className="flex items-center gap-2 mb-1.5 text-ink-soft">
                      <Activity className={cn("w-4 h-4", lastScanned.alerts.lowRetention && "text-bad")} />
                      <p className="text-xs font-medium">Retention</p>
                    </div>
                    <p className="text-sm text-ink">{lastScanned.alerts.lowRetention ? "At risk" : "Healthy"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="bg-surface border border-line rounded-2xl flex flex-col h-[600px] overflow-hidden">
              <div className="p-5 border-b border-line flex items-center gap-2 text-ink-soft">
                <History className="w-4 h-4" />
                <h3 className="text-sm font-medium text-ink">Recent check-ins</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {recentCheckIns.length === 0 ? (
                  <p className="text-sm text-ink-soft text-center py-10">No check-ins yet.</p>
                ) : (
                  recentCheckIns.map((ci: any) => (
                    <div key={ci.id} className="p-3 rounded-xl hover:bg-surface-muted transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface-muted flex items-center justify-center text-ink-soft">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink">{ci.member.name || "Unknown"}</p>
                          <p className="text-xs text-ink-soft">{new Date(ci.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      {ci.member.status === "ACTIVE" ? (
                        <CheckCircle2 className="w-4 h-4 text-good" />
                      ) : (
                        <XCircle className="w-4 h-4 text-bad" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
