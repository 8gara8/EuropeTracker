import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { Footer, Masthead, SampleBanner } from "@/components/layout/chrome";
import { SITE_DESCRIPTION, SITE_NAME, isSampleData, siteUrl } from "@/lib/site";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-newsreader", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME}: spillover risk to Europe`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: `${SITE_NAME} daily brief` }] } },
  robots: isSampleData() ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  themeColor: "#f3eee3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        {isSampleData() ? <SampleBanner /> : null}
        <div className="mx-auto max-w-[1200px] px-4 pt-5 pb-10 sm:px-8 lg:px-11">
          <Masthead />
          <main className="mt-6">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
