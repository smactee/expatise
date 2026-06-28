// components/LegalPageShell.tsx
//
// Shared page shell for the static legal pages (Privacy Policy, Terms of
// Service). Owns the chrome those pages duplicated byte-for-byte: the <main>
// wrapper + styles, the <h1> title, the effective/last-updated date block, the
// <LegalLanguageNotice/> placement, and the trailing <hr>. The per-page legal
// body is passed as `children`; the differing small-print footer is passed as
// `footer` (it renders after the shared <hr>).
//
// Server component — no 'use client'. (LegalLanguageNotice is itself a client
// component and keeps its own boundary.)

import type { ReactNode } from "react";

import LegalLanguageNotice from "@/components/LegalLanguageNotice.client";

// Shared <h2> heading style. Exported so each legal page can apply the same
// inline style to its section headings instead of re-declaring it, while
// keeping the rendered style attribute byte-identical.
export const legalH2Style = {
  marginTop: 28,
  fontSize: 18,
  fontWeight: 800,
} as const;

type LegalPageShellProps = {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  children: ReactNode;
  footer: ReactNode;
};

export default function LegalPageShell({
  title,
  effectiveDate,
  lastUpdated,
  children,
  footer,
}: LegalPageShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 16px 60px",
        maxWidth: 920,
        margin: "0 auto",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
        lineHeight: 1.6,
      }}
    >


      <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6 }}>
        {title}
      </h1>

      <div style={{ opacity: 0.8, fontSize: 14 }}>
        <div>Effective date: {effectiveDate}</div>
        <div>Last updated: {lastUpdated}</div>
      </div>

      <LegalLanguageNotice />

      {children}

      <hr style={{ margin: "28px 0" }} />

      {footer}
    </main>
  );
}
