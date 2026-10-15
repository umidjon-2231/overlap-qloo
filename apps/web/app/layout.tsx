import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Overlap: sponsorship agent",
  description: "Tell us your tour. We tell you which brands to pitch, in which cities, and why.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-3 w-3 rounded-full bg-decision" aria-hidden />
              Overlap
            </Link>
            <span className="text-xs text-muted">Sponsorship agent · evidence from Qloo taste data</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
          Affinity scores are aggregate taste signals from Qloo, not forecasts. Names identify; they do not imply endorsement.
        </footer>
      </body>
    </html>
  );
}
