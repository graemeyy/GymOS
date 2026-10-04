"use client";

import { useEffect } from "react";

// The build ID in the script URL makes each deploy install a new worker with
// its own cache (R-58).
export const serviceWorkerUrl = (buildId = process.env.NEXT_PUBLIC_BUILD_ID) => (buildId ? `/sw.js?v=${encodeURIComponent(buildId)}` : "/sw.js");

// Registers the service worker in production builds only, after the page
// has loaded, so it never competes with the first paint.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register(serviceWorkerUrl()).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
