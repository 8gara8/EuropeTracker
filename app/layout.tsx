import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer, Nav, SampleBanner } from "@/components/layout/chrome";
import { SITE_DESCRIPTION, SITE_NAME, isSampleData, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME}: spillover risk to Europe`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: `${SITE_NAME} daily brief` }] } },
  robots: isSampleData() ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {isSampleData() ? <SampleBanner /> : null}
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
