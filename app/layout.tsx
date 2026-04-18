// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { getThemeBootstrapScript } from "@/lib/theme/theme";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false; // Prevent fontawesome from adding its CSS since we did it manually above  
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Expatise - Exam Preparation Made Easy",
  description: "Prepare for your Chinese driving exam with ease using Expatise. Practice, track your progress, and ace your test!",
};

const themeBootstrapScript = getThemeBootstrapScript();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
