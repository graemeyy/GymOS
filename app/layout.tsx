import type { Metadata, Viewport } from "next";
import { Archivo_Narrow, Atkinson_Hyperlegible_Next, Barlow_Condensed, Inter, Nunito_Sans, Oswald, Saira_Condensed, Source_Sans_3 } from "next/font/google";
import { themeInitScript } from "@/components/ui/theme";
import { ToastProvider } from "@/components/ui/feedback";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { BrandingProvider } from "@/components/branding/branding-provider";
import { brandingForPage } from "@/lib/branding/service";
import { brandStylesheet } from "@/lib/branding/colour";
import { fontVariable } from "@/lib/branding/fonts";
import "./globals.css";

// The approved fonts (lib/branding/fonts.ts), self-hosted by next/font. Each
// sets its own CSS variable; the gym's choice is mapped to --font-body and
// --font-display below. Only the shipped defaults are preloaded; a font that
// isn't used is never downloaded.
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", display: "swap", adjustFontFallback: false });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap", preload: false });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow-condensed", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald", display: "swap", preload: false });
const archivoNarrow = Archivo_Narrow({ subsets: ["latin"], variable: "--font-archivo-narrow", display: "swap", preload: false });
const sairaCondensed = Saira_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-saira-condensed", display: "swap", preload: false });
const fonts = [atkinson, inter, sourceSans, nunitoSans, barlowCondensed, oswald, archivoNarrow, sairaCondensed];

// Branding comes from the database on every request (D-124), so pages are
// rendered per request and `npm run build` never reads the database.
const branding = brandingForPage;

export async function generateMetadata(): Promise<Metadata> {
  const b = await branding();
  const icon = (size: number) => `/pwa-icon/${size}${b.iconUrl ? `?${b.iconUrl.split("?")[1]}` : ""}`;
  return {
    title: { default: b.name, template: `%s · ${b.appName}` },
    description: b.tagline,
    applicationName: b.appName,
    appleWebApp: { capable: true, title: b.appName, statusBarStyle: "default" },
    icons: { icon: [{ url: icon(192), type: "image/png", sizes: "192x192" }], apple: [{ url: icon(180), sizes: "180x180" }] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFF1EF" },
    { media: "(prefers-color-scheme: dark)", color: "#121619" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const b = await branding();
  const fontStyle = { "--font-body": `var(${fontVariable(b.bodyFont)})`, "--font-display": `var(${fontVariable(b.displayFont)})` } as React.CSSProperties;
  return (
    <html lang="en-AU" className={fonts.map((f) => f.variable).join(" ")} style={fontStyle} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* The gym's colours as design tokens. Hex values are validated, so this is safe to inline. */}
        <style id="brand-tokens" dangerouslySetInnerHTML={{ __html: brandStylesheet(b.primaryColour, b.accentColour) }} />
      </head>
      <body>
        <BrandingProvider branding={b}>
          <ToastProvider>{children}</ToastProvider>
        </BrandingProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
