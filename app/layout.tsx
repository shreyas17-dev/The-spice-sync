import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BiteRoute · Food delivery",
  description: "Smart Multi-Vendor Food Delivery & Logistics Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛵</text></svg>" />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
