"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Home, QrCode, ShoppingBag, UserRound } from "lucide-react";
import { api, useMutation, useResource, type Resource } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { Button } from "@/components/ui/primitives";
import { Wordmark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme";
import { useToast } from "@/components/ui/feedback";
import { ForcedPasswordChange } from "@/components/auth/forced-password-change";
import { PreviewLink } from "@/components/auth/preview-link";
import { CartLink } from "@/components/public/cart-link";
import { useCart } from "@/lib/client/cart";
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
  { href: "/shop", label: "Shop", icon: ShoppingBag, match: (p: string) => p.startsWith("/shop") || p.startsWith("/member/orders") },
  { href: "/member/account", label: "Account", icon: UserRound, match: (p: string) => p.startsWith("/member/account") || p.startsWith("/member/membership") },
] as const;

// The member app: a top bar, and on phones a tab bar at the bottom within
// thumb reach. One /api/me request feeds every page through context. The
// shop uses it too for signed-in members, `wide` for its product grid.
export function MemberShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const me = useResource<Me>("/api/me");
  const pathname = usePathname();
  const router = useRouter();
  const { count: cartCount } = useCart();
  const bare = pathname.startsWith("/member/invoice");
  const width = wide ? "max-w-5xl" : "max-w-3xl";

  // Someone who just signed up and hasn't chosen a plan yet goes to the
  // welcome steps first. The shop stays open to them.
  useEffect(() => {
    if (me.data && !me.data.mustChangePassword && me.data.status === "PENDING" && !me.data.onboardedAt && pathname.startsWith("/member") && pathname !== "/member/welcome") router.replace("/member/welcome");
  }, [me.data, pathname, router]);

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  if (me.data?.mustChangePassword) {
    return (
      <MeContext.Provider value={me}>
        <ForcedPasswordChange kind="member" name={me.data.name ?? me.data.email} onChanged={() => void me.reload()} />
      </MeContext.Provider>
    );
  }

  if (bare) return <MeContext.Provider value={me}>{children}</MeContext.Provider>;

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-dvh pb-20 sm:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className={cn("mx-auto flex h-14 items-center justify-between gap-2 px-4", width)}>
            <Link href="/member" className="shrink-0 rounded">
              <Wordmark />
            </Link>
            <nav aria-label="Member" className="hidden items-center gap-1 sm:flex">
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-label={tabLabel(tab, cartCount)}
                  aria-current={tab.match(pathname) ? "page" : undefined}
                  className={cn("rounded px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sunken hover:text-ink", tab.match(pathname) && "text-ink underline decoration-plate decoration-2 underline-offset-8")}
                >
                  {tab.label}
                  {tab.href === "/shop" ? <CartBadge count={cartCount} /> : null}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <CartLink />
              <ThemeToggle />
              <Button variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>
        {me.data && !me.data.emailVerifiedAt ? <VerifyEmailBanner email={me.data.email} /> : null}
        {me.data && me.data.outstandingAcceptances.length > 0 && pathname !== "/member/welcome" ? <TermsBanner onAccepted={me.reload} /> : null}
        <main id="main" className={cn("mx-auto px-4 py-6", width)}>
          {children}
        </main>
        <nav aria-label="Member" data-tabbar className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-label={tabLabel(tab, cartCount)}
                    aria-current={active ? "page" : undefined}
                    className={cn("relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-xs font-medium", active ? "text-plate" : "text-ink-soft")}
                  >
                    <tab.icon className="h-5 w-5" aria-hidden="true" />
                    {tab.label}
                    {/* Drawn at the icon's top right. */}
                    {tab.href === "/shop" ? <CartBadge count={cartCount} floating /> : null}
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

// How many items are in the cart, on the Shop tab. The number is drawn for
// sight; the tab's label (tabLabel) says it to screen readers.
/** "Shop, 2 items in cart" when there's something in the cart. */
function tabLabel(tab: { href: string; label: string }, cartCount: number): string | undefined {
  return tab.href === "/shop" && cartCount > 0 ? `${tab.label}, ${cartCount} ${cartCount === 1 ? "item" : "items"} in cart` : undefined;
}

function CartBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  if (count <= 0) return null;
  return (
    <span aria-hidden="true" data-testid="cart-badge" className={cn("tabular rounded-sm bg-plate px-1 text-[0.6875rem] font-bold leading-4 text-plate-ink", floating ? "absolute left-1/2 top-1.5 ml-1.5" : "ml-1.5 align-[1px]")}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function TermsBanner({ onAccepted }: { onAccepted: () => void }) {
  const toast = useToast();
  // Stays busy after success until the banner goes away.
  const [accepted, setAccepted] = useState(false);
  const accept = useMutation(() => api("/api/me/terms", { method: "POST" }), {
    onSuccess: () => {
      setAccepted(true);
      toast("Thanks. Your acceptance is recorded.");
      onAccepted();
    },
    onError: () => toast("That didn't save. Try again.", "bad"),
  });
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
        <Button onClick={() => void accept.run()} busy={accept.busy || accepted} className="shrink-0">
          I accept
        </Button>
      </div>
    </section>
  );
}

// Until the member confirms their email (D-113, D-114). Shown on every page,
// including the welcome steps, because paying needs it.
function VerifyEmailBanner({ email }: { email: string }) {
  const toast = useToast();
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const resend = useMutation(() => api<{ ok: true; previewLink?: string }>("/api/me/email-verification", { method: "POST" }), {
    onSuccess: (result) => {
      setPreviewLink(result.previewLink ?? null);
      toast(result.previewLink ? "New link ready" : `New link sent to ${email}`);
    },
    onError: (e) => toast(e.message, "bad"),
  });
  return (
    <section aria-label="Confirm your email" className="border-b border-line bg-warn-tint">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink">
          Please confirm your email address. We sent a link to <strong className="break-all">{email}</strong>. You can&apos;t pay online until you do.
        </p>
        <Button variant="secondary" busy={resend.busy} onClick={() => void resend.run()} className="shrink-0">
          Send the link again
        </Button>
      </div>
      {previewLink ? (
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <PreviewLink href={previewLink} label="Open the confirmation link" />
        </div>
      ) : null}
    </section>
  );
}
