import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripGenie: trips planned around why you travel",
  description: "Intent-based travel personalization prototype (layer inside an OTA).",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e5a57" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-sand antialiased">{children}</body>
    </html>
  );
}
