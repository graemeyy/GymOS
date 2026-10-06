import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";
import { Wordmark } from "@/components/ui/logo";
import { LinkButton } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/theme";
import { CartLink } from "./cart-link";
import { BusinessName } from "@/components/branding/business-name";

// The public header. Reads the session cookie only to choose between
// "Sign in" and "My membership"; it never trusts it for anything else.
export async function SiteHeader() {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const isMember = session?.kind === "member";
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" className="shrink-0 rounded">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/shop" className="hidden min-h-tap items-center rounded px-3 text-sm font-medium text-ink-soft hover:bg-sunken hover:text-ink sm:inline-flex">
            Shop
          </Link>
          <CartLink />
          <ThemeToggle />
          {isMember ? (
            <LinkButton href="/member" variant="secondary" className="px-3">
              <span className="sm:hidden">Account</span>
              <span className="hidden sm:inline">My membership</span>
            </LinkButton>
          ) : (
            <LinkButton href="/login" variant="secondary" className="px-3">
              Sign in
            </LinkButton>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <span>
          <BusinessName />
        </span>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/shop" className="underline underline-offset-2 sm:hidden">
            Shop
          </Link>
          <Link href="/terms" className="underline underline-offset-2">
            Membership terms
          </Link>
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy policy
          </Link>
          <Link href="/admin/login" className="underline underline-offset-2">
            Staff sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
