"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { hasRole, type StaffRoleName } from "@/lib/roles";

interface StaffSession {
  staffId: string;
  name: string;
  role: StaffRoleName;
}

interface SessionContextValue {
  session: StaffSession | null;
  loading: boolean;
  hasRole: (min: StaffRoleName) => boolean;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  hasRole: () => false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, loading, hasRole: (min) => hasRole(session?.role, min) }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
