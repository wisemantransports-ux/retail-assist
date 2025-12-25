import type { Metadata } from "next";
import "./globals.css";
import LicenseCheck from "./components/LicenseCheck";
import { getBrand } from "./config/branding";

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrand();
    return {
      title: "Retail Pro — AI automation for retail",
      description: "AI-powered retail automation built with Next.js + Supabase",
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <LicenseCheck>
          {children}
        </LicenseCheck>
      </body>
    </html>
  );
}