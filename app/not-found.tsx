import { LinkButton } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-4xl">Page not found</h1>
      <p className="text-ink-soft">That address doesn&apos;t match anything here. It may have moved.</p>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/">Go to the home page</LinkButton>
        <LinkButton href="/admin" variant="secondary">
          Staff console
        </LinkButton>
      </div>
    </main>
  );
}
