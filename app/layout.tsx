import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Barlow_Condensed } from "next/font/google";
import { gym } from "@/lib/config";
import { themeInitScript } from "@/components/ui/theme";
import { ToastProvider } from "@/components/ui/feedback";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import "./globals.css";

const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body", display: "swap", adjustFontFallback: false });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: gym.brand.name, template: `%s · ${gym.brand.shortName}` },
  description: gym.brand.tagline,
  appleWebApp: { capable: true, title: gym.brand.shortName, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFF1EF" },
    { media: "(prefers-color-scheme: dark)", color: "#121619" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
