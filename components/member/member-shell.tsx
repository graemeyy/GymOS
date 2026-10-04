"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Home, QrCode, ShoppingBag, UserRound } from "lucide-react";
import { api, useResource, type Resource } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { Button } from "@/components/ui/primitives";
import { Wordmark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme";
import { useToast } from "@/components/ui/feedback";
import type { Me } from "./types";

const MeContext = createContext<Resource<Me> | null>(null);

export function useMe(): Resource<Me> {
  const value = useContext(MeContext);
  if (!value) throw new Error("useMe must be used inside MemberShell");
  return value;
}

const TABS = [
  { href: "/member", label: "Home", icon: Home, match: (p: string) => p === "/member" },
  { href: "/member/classes", label: "Classes", icon: CalendarDays, match: (p: string) => p.startsWith("/member/classes") },
  { href: "/member/pass", label: "Pass", icon: QrCode, match: (p: string) => p.startsWith("/member/pass") },
  { href: "/shop", label: "Shop", icon: ShoppingBag, match: (p: string) => p.startsWith("/member/orders") },
  { href: "/member/account", label: "Account", icon: UserRound, match: (p: string) => p.startsWith("/member/account") || p.startsWith("/member/membership") },
] as const;

// The member app: a top bar, and on phones a tab bar at the bottom within
// thumb reach. One /api/me request feeds every page through context.
export function MemberShell({ children }: { children: React.ReactNode }) {
  const me = useResource<Me>("/api/me");
  const pathname = usePathname();
  const router = useRouter();
  const bare = pathname.startsWith("/member/invoice");

  // Someone who just signed up and hasn't chosen a plan yet goes to the
  // welcome steps first.
  useEffect(() => {
    if (me.data && me.data.status === "PENDING" && !me.data.onboardedAt && pathname !== "/member/welcome") router.replace("/member/welcome");
  }, [me.data, pathname, router]);

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  if (bare) return <MeContext.Provider value={me}>{children}</MeContext.Provider>;

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-dvh pb-20 sm:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
            <Link href="/member" className="shrink-0 rounded">
              <Wordmark />
            </Link>
            <nav aria-label="Member" className="hidden items-center gap-1 sm:flex">
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={tab.match(pathname) ? "page" : undefined}
                  className={cn("rounded px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sunken hover:text-ink", tab.match(pathname) && "text-ink underline decoration-plate decoration-2 underline-offset-8")}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>
        {me.data && me.data.outstandingAcceptances.length > 0 && pathname !== "/member/welcome" ? <TermsBanner onAccepted={me.reload} /> : null}
        <main id="main" className="mx-auto max-w-3xl px-4 py-6">
          {children}
        </main>
        <nav aria-label="Member" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-xs font-medium", active ? "text-plate" : "text-ink-soft")}
                  >
                    <tab.icon className="h-5 w-5" aria-hidden="true" />
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </MeContext.Provider>
  );
}

function TermsBanner({ onAccepted }: { onAccepted: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const accept = async () => {
    setBusy(true);
    try {
      await api("/api/me/terms", { method: "POST" });
      toast("Thanks. Your acceptance is recorded.");
      onAccepted();
    } catch {
      toast("That didn't save. Try again.", "bad");
      setBusy(false);
    }
  };
  return (
    <section aria-label="Updated terms" className="border-b border-line bg-plate-tint">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink">
          Please read and accept our current{" "}
          <Link href="/terms" target="_blank" className="font-medium text-plate underline underline-offset-2">
            membership terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-plate underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
        <Button onClick={accept} busy={busy} className="shrink-0">
          I accept
        </Button>
      </div>
    </section>
  );
}
