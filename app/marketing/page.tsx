import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Terminal, 
  ArrowRight, 
  ChevronRight, 
  Zap, 
  BarChart3, 
  Settings 
} from 'lucide-react';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      {/* Navigation */}
      <nav className="border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">GymOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#philosophy" className="hover:text-slate-900 transition-colors">Philosophy</a>
            <a href="/login" className="hover:text-slate-900 transition-colors">Sign In</a>
            <button className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 group">
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full text-xs font-semibold text-slate-600 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
            Agent-First Management Paradigm
          </div>
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">
            Your gym, on <span className="text-slate-400">autopilot.</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            GymOS is the world's first agent-native operating system for fitness clubs. 
            Automate your back-office, predict member churn, and streamline operations with AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="w-full sm:w-auto bg-slate-900 text-white px-8 py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200">
              Launch GymOS
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all">
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Platform Philosophy */}
      <section id="philosophy" className="py-24 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-group gap-16 items-center">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold mb-6">The Agent-First Philosophy</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Most gym software is just a database with a UI. GymOS is an active participant in your business. 
                Our autonomous agents don't just record data—they act on it.
              </p>
              <div className="space-y-4">
                {[
                  "Administrative tasks handled by AI agents",
                  "Proactive failure prediction & diagnostics",
                  "Automated member billing & recovery",
                  "Verifiable agent audit trails"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center">
                      <ChevronRight className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-slate-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 font-mono text-xs">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 uppercase tracking-widest">Agent Feed // live</span>
                </div>
                <div className="space-y-3">
                  <div className="text-emerald-600">[09:42:01] ChurnShield: Identified member @jdoe at 82% risk. initiated retention sequence.</div>
                  <div className="text-slate-400">[09:44:15] MaintenanceOracle: Motor wear detected on Treadmill #4. Scheduled technician for Thursday.</div>
                  <div className="text-slate-900">[10:01:22] BillingAgent: 42 invoices processed. 100% success rate.</div>
                  <div className="animate-pulse text-slate-300">_</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-4xl font-bold tracking-tight mb-4">Built for Vitals.</h2>
            <p className="text-slate-500 max-w-md">Our core pillars focus on the critical health metrics of your fitness business.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Churn Shield */}
            <div className="p-8 border border-slate-100 rounded-3xl hover:border-slate-200 transition-colors group">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-900 transition-colors">
                <ShieldCheck className="w-6 h-6 text-slate-900 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-3">Churn Shield</h3>
              <p className="text-slate-500 leading-relaxed mb-6">
                Predictive retention that identifies at-risk members before they leave. Automated outreach that feels personal.
              </p>
              <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
            </div>

            {/* Maintenance Oracle */}
            <div className="p-8 border border-slate-100 rounded-3xl hover:border-slate-200 transition-colors group">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-900 transition-colors">
                <Activity className="w-6 h-6 text-slate-900 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-3">Maintenance Oracle</h3>
              <p className="text-slate-500 leading-relaxed mb-6">
                Autonomous diagnostics for your equipment. If a machine is failing, GymOS knows before your members do.
              </p>
              <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
            </div>

            {/* AI Agent Feed */}
            <div className="p-8 border border-slate-100 rounded-3xl hover:border-slate-200 transition-colors group">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-900 transition-colors">
                <Zap className="w-6 h-6 text-slate-900 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-3">Agent Feed</h3>
              <p className="text-slate-500 leading-relaxed mb-6">
                A real-time, verifiable audit trail of every action your AI agents take. Complete transparency, zero overhead.
              </p>
              <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-slate-100">
        <div className="max-w-5xl mx-auto bg-slate-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Settings className="w-64 h-64 text-white animate-[spin_20s_linear_infinite]" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 relative z-10">
            Stop managing. <br/>Start operating.
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto relative z-10">
            Join the waitlist for the GymOS Private Alpha and transform your facility into an agent-powered ecosystem.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-slate-100 transition-all">
              Request Alpha Access
            </button>
            <button className="text-white border border-slate-700 px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 grayscale opacity-50">
            <Terminal className="w-4 h-4" />
            <span className="font-bold tracking-tight">GymOS</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-400 font-medium">
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Twitter</a>
            <a href="#" className="hover:text-slate-900 transition-colors">GitHub</a>
          </div>
          <div className="text-slate-400 text-sm">
            © 2026 Interaction Company of California.
          </div>
        </div>
      </footer>
    </div>
  );
}
