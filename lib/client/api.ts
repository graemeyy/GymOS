"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// JSON fetch that turns the API's { error: { code, message, fields } } shape
// into a thrown ApiClientError, so every page handles failures the same way.
export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(0, "network", "Can't reach the server. Check your connection and try again.");
  }
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    const err = (data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    if (response.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
      const target = window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login";
      window.location.assign(`${target}?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiClientError(response.status, err?.code ?? "error", err?.message ?? "Something went wrong. Please try again.", err?.fields);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface Resource<T> {
  data: T | null;
  error: ApiClientError | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useResource<T>(url: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const latest = useRef(url);
  latest.current = url;

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const result = await api<T>(url);
      if (latest.current === url) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (latest.current === url) setError(e instanceof ApiClientError ? e : new ApiClientError(0, "error", "Something went wrong."));
    } finally {
      if (latest.current === url) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}
