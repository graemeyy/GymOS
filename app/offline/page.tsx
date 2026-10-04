import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Offline" };

// Shown by the service worker when there's no connection.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Wordmark />
      <h1 className="mt-8 text-3xl">You&apos;re offline</h1>
      <p className="mt-2 text-ink-soft">Check your connection and try again. No signal at the door? The front desk can look you up by name.</p>
      <div className="mt-6">
        <Link href="/member" className="font-medium text-plate underline underline-offset-2">
          Try again
        </Link>
      </div>
    </main>
  );
}
