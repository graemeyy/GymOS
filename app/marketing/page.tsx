import React from "react";
import Link from "next/link";
import { ShieldAlert, Wrench, Users, ArrowRight, Zap } from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-chalk text-ink font-sans">
      <nav className="border-b border-line">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ember flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-display font-medium text-ink">GymOS</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-ember text-white px-4 py-2 text-sm font-medium hover:bg-ember-dark transition-colors"
          >
            Open dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      <section className="pt-20 pb-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink mb-5">
            Run your gym from one screen
          </h1>
          <p className="text-lg text-ink-soft mb-8 leading-relaxed">
            Members, check-ins, billing, and equipment — all in a dashboard your front desk can actually use.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-ember text-white px-6 py-3 font-medium hover:bg-ember-dark transition-colors"
          >
            Open dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-line">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8">
          <div>
            <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center mb-4 text-ember">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-medium text-ink mb-2">Members</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Add, edit, and check in members without digging through spreadsheets.
            </p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center mb-4 text-ember">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-medium text-ink mb-2">Retention</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              See who's at risk of canceling before they do, ranked by how long it's been since they showed up.
            </p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center mb-4 text-ember">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-medium text-ink mb-2">Equipment</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Track what's operational, what needs a look, and what to fix first.
            </p>
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-line">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-ink-soft">
          <span>GymOS</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
