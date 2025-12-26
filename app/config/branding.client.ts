"use client";

import { useState, useEffect } from 'react';

export interface BrandConfig {
  name: string;
  tagline: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  domain: string;
  company: string;
  socialLinks: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
}

export const DEFAULT_BRAND: BrandConfig = {
  name: "Retail Pro",
  tagline: "AI-Powered Customer Automation",
  logo: "/logo.png",
  favicon: "/favicon.ico",
  primaryColor: "#2563EB",
  accentColor: "#10B981",
  supportEmail: "support@example.com",
  domain: "example.com",
  company: "Your Company",
  socialLinks: {
    twitter: "",
    facebook: "",
    linkedin: ""
  }
};

let cachedBrand: BrandConfig | null = null;
let fetchPromise: Promise<BrandConfig> | null = null;

export async function fetchBrand(): Promise<BrandConfig> {
  if (cachedBrand) return cachedBrand;
  
  if (fetchPromise) return fetchPromise;
  
  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/branding');
      if (res.ok) {
        cachedBrand = await res.json();
        return cachedBrand!;
      }
    } catch (error) {
      console.error('[Branding] Error fetching brand:', error);
    }
    return DEFAULT_BRAND;
  })();
  
  return fetchPromise;
}

export function useBrandSync(): BrandConfig {
  return cachedBrand || DEFAULT_BRAND;
}

export function useBrand(): BrandConfig {
  const [brand, setBrand] = useState<BrandConfig>(cachedBrand || DEFAULT_BRAND);

  useEffect(() => {
    let mounted = true;
    
    fetchBrand().then((b) => {
      if (mounted) {
        setBrand(b);
      }
    });
    
    return () => {
      mounted = false;
    };
  }, []);

  return brand;
}
