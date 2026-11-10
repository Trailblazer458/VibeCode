import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter for all text; headings use it bold with tight tracking (see .font-display in globals.css).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "TripGenie: trips planned around why you travel",
  description: "Intent-based travel personalization prototype (layer inside an OTA).",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e5a57" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
