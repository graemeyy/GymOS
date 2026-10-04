import { gym } from "@/lib/config";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";

// Shared frame for the template legal documents. Until the owner records a
// lawyer's review in config, every page says plainly that it's a template.
export function LegalPage({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {gym.business.legalName}, ABN {gym.business.abn}. Version {version}.
        </p>
        {!gym.legal.reviewedByLawyer ? (
          <p role="note" className="mt-6 rounded border border-warn bg-warn-tint px-4 py-3 text-sm font-medium text-warn">
            Template only. This document hasn&apos;t been reviewed by a lawyer yet and may not suit this gym or its state. Don&apos;t rely on it until it has been.
          </p>
        ) : null}
        <div className="legal mt-8 space-y-4 text-ink [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p]:max-w-prose [&_ul]:space-y-1">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
