import type { Metadata } from "next";
import "./globals.css";
import { getBrand } from "./config/branding";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: brand.name,
    description: brand.tagline,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}