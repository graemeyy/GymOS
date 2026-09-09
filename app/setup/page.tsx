"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, ShieldCheck, Loader2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/bootstrap")
      .then((r) => r.json())
      .then((data) => setNeedsSetup(!!data.needsSetup))
      .catch(() => setNeedsSetup(false))
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Setup failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-chalk flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!needsSetup) {
    return (
      <div className="min-h-screen bg-chalk text-ink font-sans flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-8 text-center">
          <ShieldCheck className="w-8 h-8 text-good mx-auto mb-4" />
          <h1 className="font-display text-xl font-medium text-ink mb-2">Already set up</h1>
          <p className="text-sm text-ink-soft mb-6">This gym already has staff accounts configured.</p>
          <a href="/login" className="text-sm font-medium text-ember hover:text-ember-dark">
            Go to sign in →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-chalk text-ink font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-ember flex items-center justify-center">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display font-medium text-ink">GymOS</span>
        </div>
        <h1 className="font-display text-xl font-medium text-ink mb-1">Create the owner account</h1>
        <p className="text-sm text-ink-soft mb-6">This is a one-time setup — this form only works while no staff accounts exist yet.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink">Your name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink">Password</label>
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-chalk border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
              placeholder="At least 8 characters"
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ember text-white rounded-xl py-2.5 font-medium hover:bg-ember-dark transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create owner account"}
          </button>
        </form>
      </div>
    </div>
  );
}
