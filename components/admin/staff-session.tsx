"use client";

import React, { createContext, useContext } from "react";
import { useResource } from "@/lib/client/api";
import type { Permission, StaffRoleName } from "@/lib/auth/permissions";

export interface StaffMe {
  kind: "staff";
  id: string;
  name: string;
  role: StaffRoleName;
  permissions: Permission[];
}

interface Ctx {
  me: StaffMe | null;
  loading: boolean;
  can: (p: Permission) => boolean;
}

const StaffSessionContext = createContext<Ctx>({ me: null, loading: true, can: () => false });

// Permissions come from the server. Hiding a button here is a convenience;
// the API refuses the action regardless.
export function StaffSessionProvider({ children }: { children: React.ReactNode }) {
  const { data, loading } = useResource<StaffMe>("/api/auth/me");
  const me = data?.kind === "staff" ? data : null;
  return (
    <StaffSessionContext.Provider value={{ me, loading, can: (p) => Boolean(me?.permissions.includes(p)) }}>
      {children}
    </StaffSessionContext.Provider>
  );
}

export function useStaff() {
  return useContext(StaffSessionContext);
}
