import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

// Body text in Inter; headings in Inter Tight (set up as --font-display in globals.css).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });

export const metadata: Metadata = {
  title: "TripGenie: trips planned around why you travel",
  description: "Intent-based travel personalization prototype (layer inside an OTA).",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e5a57" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
