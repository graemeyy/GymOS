"use client";

import { useId, useState } from "react";
import { api, useMutation } from "@/lib/client/api";
import { Button } from "@/components/ui/primitives";
import { FormMessage } from "@/components/ui/form";
import type { Branding } from "@/lib/branding/types";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Uploads straight away (images are saved separately from the form), so the
// preview shows the real logo.
export function ImageUpload({ kind, label, hint, current, onSaved }: { kind: "logo" | "icon"; label: string; hint: string; current: string | null; onSaved: (b: Branding) => void }) {
  const id = useId();
  const [readError, setReadError] = useState<string | null>(null);
  const upload = useMutation((dataUrl: string | null) => api<Branding>(`/api/branding/images/${kind}`, { method: "PUT", body: { dataUrl } }), { onSuccess: onSaved });
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {current ? <img src={current} alt={`Current ${label.toLowerCase()}`} className="max-h-14 max-w-14 object-contain" /> : <span className="text-xs text-[#565F66]">None</span>}
        </div>
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-describedby={`${id}-hint`}
          className="text-sm file:mr-3 file:min-h-tap file:rounded file:border file:border-line-strong file:bg-surface file:px-3 file:text-ink"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setReadError(null);
            try {
              await upload.run(await readAsDataUrl(file));
            } catch (err) {
              setReadError(err instanceof Error ? err.message : "Couldn't read that file.");
            }
          }}
        />
        {current ? (
          <Button variant="ghost" busy={upload.busy} onClick={() => void upload.run(null)}>
            Remove
          </Button>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="text-sm text-ink-soft">
        {hint}
      </p>
      {readError || upload.error ? <FormMessage>{upload.fields.dataUrl ?? readError ?? upload.error}</FormMessage> : null}
    </div>
  );
}
