"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Dumbbell,
  ScanFace,
  ShieldAlert,
  CalendarDays,
  Clock,
  Settings as SettingsIcon,
  Menu,
  X,
  Zap,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { ROLE_LABELS } from "@/lib/roles";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/classes", label: "Classes", icon: CalendarDays },
  { href: "/shifts", label: "Shifts", icon: Clock },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/equipment", label: "Equipment", icon: Dumbbell },
  { href: "/iot", label: "Access control", icon: ScanFace },
  { href: "/radar", label: "Retention", icon: ShieldAlert },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-ember-soft text-ember-dark" : "text-ink-soft hover:bg-surface-muted hover:text-ink"
            }`}
          >
            <item.icon className="w-4.5 h-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink"
    >
      {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
    </button>
  );
}

function StaffFooter() {
  const router = useRouter();
  const { session } = useSession();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (!session) return null;

  return (
    <div className="mt-auto pt-5 border-t border-line flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink truncate">{session.name}</p>
        <p className="text-xs text-ink-soft">{ROLE_LABELS[session.role]}</p>
      </div>
      <button
        onClick={handleSignOut}
        aria-label="Sign out"
        className="p-2 rounded-lg text-ink-soft hover:bg-surface-muted hover:text-ink shrink-0"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-chalk lg:flex">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-surface lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-ember flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-medium text-ink">GymOS</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-ink-soft hover:text-ink"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface p-5 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-display font-medium text-ink">GymOS</span>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="p-1 text-ink-soft">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <StaffFooter />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 lg:border-r lg:border-line lg:bg-surface lg:px-5 lg:py-6">
        <div className="flex items-center justify-between px-2 mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ember flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-display text-lg font-medium text-ink">GymOS</span>
          </Link>
          <ThemeToggle />
        </div>
        <NavLinks pathname={pathname} />
        <StaffFooter />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
