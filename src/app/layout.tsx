import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Level-design tool for exploring LILA BLACK player telemetry: journeys, combat events, heatmaps and match playback.";

export const metadata: Metadata = {
  // Absolute base so the Open Graph image resolves when a link is pasted into Slack.
  metadataBase: new URL("https://lila-player-journeys-peach.vercel.app"),
  title: "LILA BLACK · Player Journeys",
  description,
  openGraph: {
    title: "LILA BLACK · Player Journeys",
    description,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "LILA BLACK · Player Journeys", description },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
