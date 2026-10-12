import type { Metadata } from "next";
import { Sofia_Sans, Sofia_Sans_Extra_Condensed, Pixelify_Sans } from "next/font/google";
import { getConfig } from "@/lib/config";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

// Every page reads the database at request time; nothing is prerendered at build time
export const dynamic = "force-dynamic";

const body = Sofia_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Sofia_Sans_Extra_Condensed({ subsets: ["latin"], variable: "--font-display-face", display: "swap" });
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel-face", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { site } = getConfig();
  return {
    title: { default: site.name, template: `%s | ${site.name}` },
    description: site.tagline,
    metadataBase: site.url ? new URL(site.url) : undefined,
  };
}

/** theme.* from config.yml as CSS variables, so re-branding needs no rebuild */
function themeCss(): string {
  const { theme } = getConfig();
  const safe = (v: string) => !/[;{}<>]/.test(v);
  const vars: Record<string, string> = { "--accent": theme.accent, "--accent-ink": inkFor(theme.accent), ...theme.colors };
  const body = Object.entries(vars)
    .filter(([k, v]) => /^--[a-z0-9-]+$/i.test(k) && safe(v))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${body}}`;
}

/** Dark text on light accents, light text on dark ones */
function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#16120a" : "#ffffff";
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${pixel.variable}`}>
      <head>
        <style>{themeCss()}</style>
      </head>
      <body className="flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 sm:px-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
