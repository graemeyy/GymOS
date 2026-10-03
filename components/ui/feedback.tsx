"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/client/cn";
import { Button } from "./primitives";

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded border border-dashed border-line-strong px-4 py-8 sm:items-center sm:text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <p className="max-w-prose text-sm text-ink-soft">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded border border-bad bg-bad-tint px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="font-medium text-bad">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded bg-sunken", className)} />;
}

export function LoadingRows({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// Wraps a resource's three states so every list renders them the same way.
export function AsyncBlock<T>({
  loading,
  error,
  data,
  onRetry,
  loadingLabel,
  children,
}: {
  loading: boolean;
  error: { message: string } | null;
  data: T | null;
  onRetry?: () => void;
  loadingLabel?: string;
  children: (data: T) => React.ReactNode;
}) {
  if (error) return <div className="p-4"><ErrorState message={error.message} onRetry={onRetry} /></div>;
  if (loading && data === null) return <LoadingRows label={loadingLabel} />;
  if (data === null) return null;
  return <>{children(data)}</>;
}

type Toast = { id: number; tone: "good" | "bad"; message: string };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "good") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <p
            key={t.id}
            className={cn(
              "pointer-events-auto max-w-md rounded border px-4 py-3 text-sm font-medium shadow-overlay",
              t.tone === "good" ? "border-good bg-surface text-ink" : "border-bad bg-bad-tint text-bad"
            )}
          >
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
