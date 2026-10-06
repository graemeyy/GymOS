"use client";

import { createContext, useContext } from "react";
import { brandingFrom } from "@/lib/branding/defaults";
import type { Branding } from "@/lib/branding/types";

// The gym's branding for browser code (D-124). The root layout reads it from
// the database on each request and passes it down; outside the app (tests,
// error pages) it falls back to config/gym.config.json.
const BrandingContext = createContext<Branding>(brandingFrom(null));

export function BrandingProvider({ branding, children }: { branding: Branding; children: React.ReactNode }) {
  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  return useContext(BrandingContext);
}
