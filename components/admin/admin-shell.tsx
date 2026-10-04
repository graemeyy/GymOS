"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  Dumbbell,
  Gauge,
  LogOut,
  Menu,
  Package,
  ScanLine,
  Settings,
  UserRoundSearch,
  Users,
  X,
  DoorOpen,
  Layers,
  LineChart,
  Megaphone,
  ShoppingBag,
  Receipt,
} from "lucide-react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { IconButton } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/theme";
import { Wordmark } from "@/components/ui/logo";
import { useModalBehaviour } from "@/components/ui/dialog";
import { useStaff } from "./staff-session";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; permission: Permission };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Today",
    items: [
      { href: "/admin", label: "Dashboard", icon: Gauge, permission: "dashboard:view" },
      { href: "/admin/check-in", label: "Check-in", icon: ScanLine, permission: "checkin:scan" },
      { href: "/admin/classes", label: "Classes", icon: CalendarDays, permission: "classes:read" },
    ],
  },
  {
    group: "Members",
    items: [
      { href: "/admin/members", label: "Members", icon: Users, permission: "members:read" },
      { href: "/admin/plans", label: "Plans", icon: Layers, permission: "members:read" },
      { href: "/admin/retention", label: "Retention", icon: UserRoundSearch, permission: "members:read" },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone, permission: "announcements:manage" },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/admin/billing", label: "Payments", icon: CreditCard, permission: "revenue:view" },
      { href: "/admin/finance", label: "Finance", icon: LineChart, permission: "finance:view" },
      { href: "/admin/shop/orders", label: "Orders", icon: Receipt, permission: "orders:fulfil" },
      { href: "/admin/shop", label: "Shop products", icon: ShoppingBag, permission: "orders:fulfil" },
    ],
  },
  {
    group: "Gym",
    items: [
      { href: "/admin/shifts", label: "Shifts", icon: Clock, permission: "shifts:read" },
      { href: "/admin/equipment", label: "Equipment", icon: Dumbbell, permission: "equipment:read" },
      { href: "/admin/inventory", label: "Stock", icon: Package, permission: "inventory:read" },
      { href: "/admin/access", label: "Door access", icon: DoorOpen, permission: "checkin:scan" },
      { href: "/admin/audit", label: "Audit log", icon: ClipboardList, permission: "audit:read" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "dashboard:view" },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, loading } = useStaff();
  // Show nothing until permissions arrive, so no one glimpses a link their
  // role can't use.
  if (loading) return <nav aria-label="Staff" aria-busy="true" className="min-h-[20rem]" />;
  return (
    <nav aria-label="Staff" className="flex flex-col gap-5">
      {NAV.map((section) => {
        const items = section.items.filter((i) => can(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={section.group}>
            <p className="px-3 pb-1 text-xs font-medium text-ink-soft">{section.group}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active =
                  item.href === "/admin" || item.href === "/admin/shop"
                    ? pathname === item.href || (item.href === "/admin/shop" && pathname.startsWith("/admin/shop/products"))
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-tap items-center gap-3 rounded px-3 text-sm font-medium",
                        active ? "bg-plate-tint text-plate" : "text-ink-soft hover:bg-sunken hover:text-ink"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function StaffFooter() {
  const router = useRouter();
  const { me } = useStaff();
  if (!me) return null;
  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/admin/login");
    router.refresh();
  };
  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{me.name}</p>
        <p className="text-xs text-ink-soft">{ROLE_LABELS[me.role]}</p>
      </div>
      <IconButton label="Sign out" onClick={signOut}>
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useModalBehaviour(open, drawerRef, close);

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Mobile top bar: same open/close behaviour as before, now keyboard-safe. */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface px-3 lg:hidden">
        <Link href="/admin" className="rounded px-1">
          <Wordmark />
        </Link>
        <div className="flex items-center">
          <ThemeToggle />
          <IconButton label="Open menu" aria-expanded={open} aria-controls="staff-drawer" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-scrim/40" onClick={close} />
          <div
            ref={drawerRef}
            id="staff-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col gap-5 overflow-y-auto bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <Wordmark />
              <IconButton label="Close menu" onClick={close}>
                <X className="h-5 w-5" aria-hidden="true" />
              </IconButton>
            </div>
            <NavLinks onNavigate={close} />
            <StaffFooter />
          </div>
        </div>
      ) : null}

      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-4">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="rounded px-1">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </div>
        <NavLinks />
        <StaffFooter />
      </aside>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
