// A single-use link shown on screen because email isn't set up. Only ever
// returned outside production (D-115), and labelled so nobody mistakes it
// for how the live site behaves.
export function PreviewLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="rounded border border-warn bg-warn-tint px-4 py-3 text-sm">
      <p className="font-medium text-ink">Email isn&apos;t set up here, so the link is shown instead.</p>
      <p className="mt-1 text-ink-soft">This only happens in development and on previews, never on the live site.</p>
      <a href={href} className="mt-2 inline-block font-medium text-plate underline underline-offset-2">
        {label}
      </a>
    </div>
  );
}
