import type { Metadata } from "next";
import "./globals.css";
import { getBrand } from "./config/branding";

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrand();
  return {
    title: brand.name,
    description: brand.tagline,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}