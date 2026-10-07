import { currentMemberId } from "@/lib/auth/server-session";
import { MemberShell } from "@/components/member/member-shell";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";

// Signed-in members shop inside the member app, with its top bar and tab bar
// (Shop is one of the tabs). Everyone else gets the public site's header and
// footer. The session is checked the same way the shop pages check it.
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  if (await currentMemberId()) return <MemberShell wide>{children}</MemberShell>;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
