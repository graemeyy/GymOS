"use client";
import React, { useState } from 'react';
import { ShieldCheck, Wrench, Activity, Check, X } from "lucide-react";

export function AgentFeed({ initialActions }) {
  const [actions, setActions] = useState(initialActions);
  const handleStatusChange = async (id, status) => {
    const res = await fetch('/api/agent-actions', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) setActions(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };
  const getIcon = (category) => {
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
          <div key={action.id} className="flex gap-4 group">
            <div className="mt-0.5"><Icon className="w-4 h-4 text-zinc-400 group-hover:text-white" /></div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-zinc-300 font-bold">{action.title}</p>
                  <p className="text-[11px] text-zinc-500 mb-2">{action.description}</p>
                </div>
                {action.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleStatusChange(action.id, 'APPROVED')} className="p-1 text-emerald-500"><Check className="w-3 h-3" /></button>
                    <button onClick={() => handleStatusChange(action.id, 'REJECTED')} className="p-1 text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${action.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{action.status}</span>
                )}
              </div>
              <p className="text-[10px] font-bold text-zinc-600 uppercase">{new Date(action.createdAt).toLocaleTimeString()}</p>
            </div>
          </div>
        );
      })}
      {actions.length === 0 && <p className="text-xs text-zinc-600 italic">No recent actions</p>}
    </div>
  );
}
