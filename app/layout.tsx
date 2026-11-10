import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hotel IT Asset Management & Maintenance System",
  description:
    "Hotel IT Operations Platform — Next.js App Router + Google Apps Script + Google Sheets & Drive (Asia/Jakarta WIB)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-slate-50 text-slate-900 antialiased"
      >
        {children}
      </body>
    </html>
  );
}
