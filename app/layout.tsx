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
      <body className="min-h-dvh antialiased">
        <div className="mx-auto min-h-dvh max-w-[480px] bg-sand shadow-[0_0_60px_rgba(0,0,0,0.08)]">{children}</div>
      </body>
    </html>
  );
}
