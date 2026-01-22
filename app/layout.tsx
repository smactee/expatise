// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from '../components/ThemeProvider';
import { UserProfileProvider } from "@/components/UserProfile";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false; // Prevent fontawesome from adding its CSS since we did it manually above  
import { EntitlementsProvider } from "@/components/EntitlementsProvider.client";
import FreeUsageProgressBadge from "@/components/FreeUsageProgressBadge.client";
import SwipeBack from "@/components/SwipeBack.client";



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"]});

export const metadata: Metadata = {
  title: "Expatise - Exam Preparation Made Easy",
  description: "Prepare for your Chinese driving exam with ease using Expatise. Practice, track your progress, and ace your test!",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nunitoSans.variable} antialiased`}
      >
        <EntitlementsProvider>
          {/* ✅ mount once, globally => shows on /test/* too */}
          <FreeUsageProgressBadge />

          <ThemeProvider>
            <UserProfileProvider>
              <SwipeBack />
              {children}
              </UserProfileProvider>
          </ThemeProvider>
        </EntitlementsProvider>
      </body>
    </html>
  );
}

