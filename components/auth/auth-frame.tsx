import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";

export function AuthFrame({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-block rounded">
          <Wordmark />
        </Link>
        <h1 className="mb-6 text-3xl">{title}</h1>
        <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">{children}</div>
        {footer ? <div className="mt-4 text-sm text-ink-soft">{footer}</div> : null}
      </div>
    </main>
  );
}
