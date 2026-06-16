"use client";
import React, { useState } from 'react';
import { ShieldCheck, Wrench, Activity, Check, X } from "lucide-react";

interface AgentAction {
  id: string;
  category: string;
  title: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string | Date;
}

interface AgentFeedProps {
  initialActions: AgentAction[];
}

export function AgentFeed({ initialActions }: AgentFeedProps) {
  const [actions, setActions] = useState<AgentAction[]>(initialActions);
  
  const handleStatusChange = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const res = await fetch('/api/agent-actions', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) setActions(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const getIcon = (category: string) => {
    const cat = category ? category.toLowerCase() : '';
    if (cat.includes('shield')) return ShieldCheck;
    if (cat.includes('wrench') || cat.includes('maintenance')) return Wrench;
    return Activity;
  };

  return (
    <div className="space-y-6">
      {actions.map((action) => {
        const Icon = getIcon(action.category);
        return (
          <div key={action.id} className="flex gap-4 group bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-2xl hover:bg-zinc-900 hover:border-zinc-700 transition-all duration-300">
            <div className="mt-0.5">
              <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800 group-hover:border-zinc-600 transition-colors">
                <Icon className="w-4 h-4 text-zinc-400 group-hover:text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-zinc-300 font-bold tracking-tight">{action.title}</p>
                  <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">{action.description}</p>
                </div>
                {action.status === 'PENDING' ? (
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => handleStatusChange(action.id, 'APPROVED')} 
                      className="p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleStatusChange(action.id, 'REJECTED')} 
                      className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                    action.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {action.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-zinc-800" />
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">{new Date(action.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        );
      })}
      {actions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-zinc-800 rounded-3xl">
          <Activity className="w-8 h-8 text-zinc-800 mb-2" />
          <p className="text-xs text-zinc-600 italic">No recent actions detected</p>
        </div>
      )}
    </div>
  );
}
