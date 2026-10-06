"use client";

import React, { createContext, useContext } from "react";
import { useResource } from "@/lib/client/api";
import { can as hasPermission, type Permission } from "@/lib/auth/permissions";

export interface StaffMe {
  kind: "staff";
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  permissions: Permission[];
  mustChangePassword?: boolean;
  // The locations their role applies at, or null for all (D-128).
  locationIds?: string[] | null;
}

interface Ctx {
  me: StaffMe | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
  can: (p: Permission) => boolean;
}

const StaffSessionContext = createContext<Ctx>({ me: null, loading: true, error: false, reload: () => undefined, can: () => false });

// Permissions come from the server. Hiding a button here is a convenience;
// the API refuses the action regardless.
export function StaffSessionProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, reload } = useResource<StaffMe>("/api/auth/me");
  const me = data?.kind === "staff" ? data : null;
  return (
    <StaffSessionContext.Provider value={{ me, loading, error: Boolean(error) && !me, reload: () => void reload(), can: (p) => hasPermission(me, p) }}>
      {children}
    </StaffSessionContext.Provider>
  );
}

export function useStaff() {
  return useContext(StaffSessionContext);
}
