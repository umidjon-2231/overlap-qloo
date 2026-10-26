import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"], axes: ["wdth", "opsz"] });
const ui = Inter({ variable: "--font-ui", subsets: ["latin"] });
const data = JetBrains_Mono({ variable: "--font-data", subsets: ["latin"] });
// The condensed caps as a static cut with overlapping contours removed, so outlined (text-stroke) city names print clean.
const stack = localFont({ src: "./fonts/bricolage-stack.woff2", variable: "--font-stack", weight: "800", display: "swap" });

export const metadata: Metadata = {
  // Absolute base for og:image and other metadata URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Overlap: sponsorship agent",
  description: "Tell us your tour. We tell you which brands to pitch, in which cities, and why.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${stack.variable} ${ui.variable} ${data.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="on-ink bg-ink text-on-ink">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center" aria-label="Overlap home">
              <Image src="/brand/overlap-logo-horizontal-dark.svg" alt="Overlap" width={624} height={174} priority unoptimized className="h-7 w-auto" />
            </Link>
            <Link
              href="/"
              className="rounded-[2px] border border-on-ink-rule px-3 py-1.5 text-sm font-medium text-on-ink transition-colors hover:border-on-ink hover:bg-on-ink hover:text-ink"
            >
              New run
            </Link>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
