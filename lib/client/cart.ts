"use client";

import { useCallback, useSyncExternalStore } from "react";

// The cart lives in this browser only (localStorage). It holds variant IDs
// and quantities, never prices: the server prices everything at checkout.
export interface CartLine {
  variantId: string;
  quantity: number;
}

const KEY = "gymos-cart-v1";
const EVENT = "gymos-cart-change";
const EMPTY: CartLine[] = [];
let cached: { raw: string | null; lines: CartLine[] } = { raw: null, lines: EMPTY };

function read(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cached.raw) return cached.lines;
  let lines: CartLine[] = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      lines = parsed
        .filter((l): l is CartLine => typeof l?.variantId === "string" && Number.isInteger(l?.quantity) && l.quantity > 0)
        .map((l) => ({ variantId: l.variantId, quantity: Math.min(l.quantity, 20) }));
    }
  } catch {
    lines = EMPTY;
  }
  cached = { raw, lines };
  return lines;
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Private mode or storage full: the cart just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  const setQuantity = useCallback((variantId: string, quantity: number) => {
    const current = read();
    const next = quantity <= 0 ? current.filter((l) => l.variantId !== variantId) : current.some((l) => l.variantId === variantId) ? current.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, 20) } : l)) : [...current, { variantId, quantity: Math.min(quantity, 20) }];
    write(next);
  }, []);
  const add = useCallback((variantId: string, quantity = 1) => {
    const existing = read().find((l) => l.variantId === variantId)?.quantity ?? 0;
    setQuantity(variantId, existing + quantity);
  }, [setQuantity]);
  const clear = useCallback(() => write([]), []);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  return { lines, count, add, setQuantity, clear };
}
