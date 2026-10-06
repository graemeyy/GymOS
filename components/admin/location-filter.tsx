"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { useResource } from "@/lib/client/api";
import { useStaff } from "@/components/admin/staff-session";
import { SelectField } from "@/components/ui/form";

export interface LocationOption {
  id: string;
  name: string;
  code: string;
}

interface Ctx {
  /** Every open location this person can use. */
  locations: LocationOption[];
  /** The chosen location, or null for every location they can see. */
  selected: string | null;
  setSelected: (id: string | null) => void;
  /** `locationId=...` for API calls, or "" for every location. */
  param: (prefix?: "?" | "&") => string;
  /** A single location, for screens that need one (check-in, new classes). */
  current: string | null;
  multiple: boolean;
  ready: boolean;
  /** Fetch the locations again, after one is added, renamed or archived. */
  reload: () => Promise<void>;
}

const STORAGE_KEY = "gymos.location";
// Without a provider (unit tests, pages outside the console) there is one
// location and nothing to wait for.
const LocationContext = createContext<Ctx>({ locations: [], selected: null, setSelected: () => undefined, param: () => "", current: null, multiple: false, ready: true, reload: async () => undefined });

// The location filter at the top of every staff page (D-125). It remembers
// the choice on this device. Someone whose role covers one location is fixed
// to it; with only one location, the filter isn't shown at all.
export function LocationFilterProvider({ children }: { children: React.ReactNode }) {
  const { me } = useStaff();
  const { data, reload } = useResource<LocationOption[]>(me ? "/api/locations" : null);
  const scope = me?.isOwner ? null : (me?.locationIds ?? null);
  const locations = useMemo(() => (data ?? []).filter((l) => !scope || scope.includes(l.id)), [data, scope]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    try {
      setChosen(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      setChosen(null);
    }
  }, []);

  const setSelected = useCallback((id: string | null) => {
    setChosen(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing: the choice lasts until the page is reloaded.
    }
  }, []);

  const fixed = locations.length === 1 ? locations[0].id : null;
  const selected = fixed ?? (chosen && locations.some((l) => l.id === chosen) ? chosen : null);
  const value: Ctx = {
    locations,
    selected,
    setSelected,
    param: (prefix = "&") => (selected ? `${prefix}locationId=${encodeURIComponent(selected)}` : ""),
    current: selected ?? locations[0]?.id ?? null,
    multiple: locations.length > 1,
    ready: Boolean(data),
    reload,
  };
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationFilter() {
  return useContext(LocationContext);
}

export function LocationSwitcher({ className }: { className?: string }) {
  const { locations, selected, setSelected, multiple } = useLocationFilter();
  if (!multiple) return null;
  return (
    <label className={className}>
      <span className="sr-only">Location</span>
      <span className="flex items-center gap-1.5 rounded border border-line-strong bg-surface px-2">
        <MapPin className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
        <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value || null)} className="min-h-tap w-full bg-transparent text-sm text-ink focus:outline-none" aria-label="Location">
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** The location a new row belongs to: the filter's choice, else the first
 * location this person can use. */
export function useDefaultLocation() {
  return useLocationFilter().current ?? "";
}

// A location picker for forms. Hidden when there's only one location, since
// everything then belongs to it.
export function LocationField({
  value,
  onChange,
  error,
  label = "Location",
  allLabel,
  hint,
}: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
  label?: string;
  /** Offer "every location" (the empty value) with this wording. */
  allLabel?: string;
  hint?: string;
}) {
  const { locations, multiple } = useLocationFilter();
  if (!multiple) return null;
  return (
    <SelectField label={label} hint={hint} value={value} error={error} onChange={(e) => onChange(e.target.value)}>
      {allLabel ? <option value="">{allLabel}</option> : null}
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </SelectField>
  );
}

/** A location's name, shown only when there's more than one location. */
export function LocationName({ location, className }: { location: { name: string } | null | undefined; className?: string }) {
  const { multiple } = useLocationFilter();
  if (!multiple || !location) return null;
  return (
    <span className={className}>
      <MapPin className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
      {location.name}
    </span>
  );
}
