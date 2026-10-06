"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api, useMutation, useResource } from "@/lib/client/api";
import { AU_STATES } from "@/lib/config/constants";
import { BODY_FONTS, DISPLAY_FONTS, type BodyFontId, type DisplayFontId } from "@/lib/branding/fonts";
import { HEX } from "@/lib/branding/colour";
import type { Branding } from "@/lib/branding/types";
import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { AsyncBlock, useToast } from "@/components/ui/feedback";
import { FormMessage, SelectField, TextareaField, TextField } from "@/components/ui/form";
import { BrandPreview } from "@/components/admin/branding/brand-preview";
import { ContrastList } from "@/components/admin/branding/contrast-list";
import { ImageUpload } from "@/components/admin/branding/image-upload";

type Form = Omit<Branding, "logoUrl" | "iconUrl">;

function toForm(b: Branding): Form {
  const { logoUrl: _logo, iconUrl: _icon, ...rest } = b;
  return rest;
}

// The Branding page (D-124): everything that makes this copy of GymOS look
// like this gym, with a live preview and contrast checks. Owner only by
// default (branding.edit). Changes are in the audit log.
export default function BrandingPage() {
  const branding = useResource<Branding>("/api/branding");
  return (
    <>
      <PageHeader title="Branding" description="Your gym's name, logo, colours and fonts, for the member app, the staff console and every email. Changes show for everyone straight away." />
      <AsyncBlock loading={branding.loading} error={branding.error} data={branding.data} onRetry={branding.reload}>
        {(b) => <BrandingForm initial={b} />}
      </AsyncBlock>
    </>
  );
}

function BrandingForm({ initial }: { initial: Branding }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [images, setImages] = useState({ logoUrl: initial.logoUrl, iconUrl: initial.iconUrl });
  const save = useMutation(() => api<Branding>("/api/branding", { method: "PUT", body: form }), {
    onSuccess: (saved) => {
      setForm(toForm(saved));
      toast("Branding saved");
      // Re-renders the layout, so the console picks up the new look too.
      router.refresh();
    },
  });
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAddress = (key: keyof Form["address"], value: string) => setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  const onImage = (saved: Branding) => {
    setImages({ logoUrl: saved.logoUrl, iconUrl: saved.iconUrl });
    toast("Image saved");
    router.refresh();
  };
  const err = save.fields;
  const coloursValid = HEX.test(form.primaryColour) && HEX.test(form.accentColour);

  return (
    <form
      noValidate
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        void save.run();
      }}
      className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"
    >
      <div className="space-y-6">
        <Panel aria-labelledby="identity-heading">
          <PanelHeader id="identity-heading" title="Name" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <TextField label="Gym name" required value={form.name} error={err.name} onChange={(e) => set("name", e.target.value)} hint="As members know it, on the home page and in page titles." />
            <TextField label="App name" required maxLength={20} value={form.appName} error={err.appName} onChange={(e) => set("appName", e.target.value)} hint="Short: under the icon on a phone's home screen, and in email subjects." />
            <TextField label="Tagline" required value={form.tagline} error={err.tagline} onChange={(e) => set("tagline", e.target.value)} wrapperClassName="sm:col-span-2" />
            <TextField label="Initials" required maxLength={3} value={form.logoText} error={err.logoText} onChange={(e) => set("logoText", e.target.value)} hint="Up to three letters, shown in the round mark when there's no logo." />
          </div>
        </Panel>

        <Panel aria-labelledby="images-heading">
          <PanelHeader id="images-heading" title="Logo and app icon" />
          <div className="space-y-6 p-4">
            <ImageUpload kind="logo" label="Logo" hint="PNG, JPEG or WebP, up to 256 KB. Shown beside the app name; a wide logo on a transparent background works best." current={images.logoUrl} onSaved={onImage} />
            <ImageUpload kind="icon" label="App icon" hint="A square PNG, at least 512 by 512 pixels, up to 256 KB. Used when members add the app to their home screen, and as the browser tab icon." current={images.iconUrl} onSaved={onImage} />
          </div>
        </Panel>

        <Panel aria-labelledby="colours-heading">
          <PanelHeader id="colours-heading" title="Colours" />
          <div className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ColourField label="Main colour" hint="Buttons, links and highlights." value={form.primaryColour} error={err.primaryColour} onChange={(v) => set("primaryColour", v)} />
              <ColourField label="Accent colour" hint="The one bright highlight, on dark panels." value={form.accentColour} error={err.accentColour} onChange={(v) => set("accentColour", v)} />
            </div>
            {coloursValid ? <ContrastList primaryColour={form.primaryColour} accentColour={form.accentColour} /> : null}
          </div>
        </Panel>

        <Panel aria-labelledby="fonts-heading">
          <PanelHeader id="fonts-heading" title="Fonts" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <SelectField label="Text" value={form.bodyFont} error={err.bodyFont} onChange={(e) => set("bodyFont", e.target.value as BodyFontId)} hint={BODY_FONTS.find((f) => f.id === form.bodyFont)?.note}>
              {BODY_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </SelectField>
            <SelectField label="Headings" value={form.displayFont} error={err.displayFont} onChange={(e) => set("displayFont", e.target.value as DisplayFontId)} hint={DISPLAY_FONTS.find((f) => f.id === form.displayFont)?.note}>
              {DISPLAY_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </SelectField>
          </div>
        </Panel>

        <Panel aria-labelledby="email-heading">
          <PanelHeader id="email-heading" title="Emails" />
          <div className="grid gap-4 p-4">
            <TextField label="Sender name" required value={form.emailSenderName} error={err.emailSenderName} onChange={(e) => set("emailSenderName", e.target.value)} hint="Who emails appear to be from. The address itself is set by EMAIL_FROM on the server." />
            <TextareaField label="Footer" rows={3} value={form.emailFooter} error={err.emailFooter} onChange={(e) => set("emailFooter", e.target.value)} hint="Added to the end of every email. Leave empty for none." />
          </div>
        </Panel>

        <Panel aria-labelledby="business-heading">
          <PanelHeader id="business-heading" title="Business details" />
          <p className="border-b border-line px-4 py-3 text-sm text-ink-soft">On the membership terms, privacy policy, tax invoices and the footer of every page.</p>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <TextField label="Legal name" required value={form.legalName} error={err.legalName} onChange={(e) => set("legalName", e.target.value)} />
            <TextField label="ABN" required inputMode="numeric" value={form.abn} error={err.abn} onChange={(e) => set("abn", e.target.value)} />
            <TextField label="Contact email" type="email" required value={form.contactEmail} error={err.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            <TextField label="Contact phone" type="tel" required value={form.contactPhone} error={err.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
            <TextField label="Street address" required value={form.address.line1} error={err["address.line1"]} onChange={(e) => setAddress("line1", e.target.value)} wrapperClassName="sm:col-span-2" />
            <TextField label="Address line 2" value={form.address.line2} error={err["address.line2"]} onChange={(e) => setAddress("line2", e.target.value)} wrapperClassName="sm:col-span-2" />
            <TextField label="Suburb" required value={form.address.suburb} error={err["address.suburb"]} onChange={(e) => setAddress("suburb", e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="State" value={form.address.state} error={err["address.state"]} onChange={(e) => setAddress("state", e.target.value)}>
                {AU_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SelectField>
              <TextField label="Postcode" required inputMode="numeric" maxLength={4} value={form.address.postcode} error={err["address.postcode"]} onChange={(e) => setAddress("postcode", e.target.value)} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Panel aria-labelledby="preview-heading">
          <PanelHeader id="preview-heading" title="Preview" />
          <div className="p-4">
            {coloursValid ? <BrandPreview {...form} logoUrl={images.logoUrl} /> : <p className="text-sm text-ink-soft">Enter both colours as hex values, like #1F5AA6, to see the preview.</p>}
          </div>
        </Panel>
        {save.error ? <FormMessage>{save.error}</FormMessage> : null}
        <Button type="submit" busy={save.busy} className="w-full">
          Save branding
        </Button>
      </div>
    </form>
  );
}

function ColourField({ label, hint, value, error, onChange }: { label: string; hint: string; value: string; error?: string; onChange: (value: string) => void }) {
  const valid = HEX.test(value);
  return (
    <div className="flex items-start gap-2">
      <input
        type="color"
        aria-label={`${label} picker`}
        value={valid ? value.toLowerCase() : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="mt-7 h-11 w-12 shrink-0 cursor-pointer rounded border border-line-strong bg-surface p-1"
      />
      <TextField label={label} hint={hint} value={value} error={error ?? (valid ? undefined : "Use a hex colour like #1F5AA6")} onChange={(e) => onChange(e.target.value.trim())} wrapperClassName="flex-1" spellCheck={false} autoCapitalize="characters" maxLength={7} />
    </div>
  );
}
