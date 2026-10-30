import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gamedev-studio.pladsen.dev"),
  title: "GameDev Studio (Beta) - Free Open Source Game Development Toolkit",
  description:
    "Create pixel art, music, sound effects, tilemaps, dialogue trees, and plan your game — all in one free, open source app. No watermarks. No paywalls.",
  keywords: [
    "game development",
    "pixel art",
    "sprite editor",
    "game music",
    "sound effects",
    "tilemap editor",
    "dialogue tree",
    "open source",
    "free",
    "indie game dev",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
