"use client";

import { Button } from "@/components/ui/primitives";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-4xl">This page didn&apos;t load</h1>
      <p className="text-ink-soft">Something went wrong on our side. Try again, and if it keeps happening let the front desk know.</p>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
