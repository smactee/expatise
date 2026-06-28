// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { getThemeBootstrapScript } from "@/lib/theme/theme";
import { getLocaleBootstrapScript } from "@/lib/i18n/localeBootstrap";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false; // Prevent fontawesome from adding its CSS since we did it manually above
import Providers from "./providers";

// Arabic webfont is self-hosted + glyph-subset (see @font-face in globals.css:
// `--font-arabic`). Replaces next/font's full-Arabic-block download (164KB) with
// a standard-Arabic subset (~36KB). Latin glyphs/digits fall through to the
// existing sans stack via unicode-range, so western numerals (123) are preserved.

export const metadata: Metadata = {
  title: "Expatise - Exam Preparation Made Easy",
  description: "Prepare for your Chinese driving exam with ease using Expatise. Practice, track your progress, and ace your test!",
};

const themeBootstrapScript = getThemeBootstrapScript();
const localeBootstrapScript = getLocaleBootstrapScript();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang/dir are placeholders for SSR; the locale bootstrap script below
    // corrects them from localStorage before first paint (and I18nProvider keeps
    // them in sync on switch). suppressHydrationWarning covers that mutation.
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeBootstrapScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
